import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js';
import { Registration, Event } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';

const upload = multer({ storage: multer.memoryStorage() });
export const registrationsRouter = Router();

// GET /registrations - Paginated list with unified case-insensitive search and filters
registrationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'reg_id', 
      order = 'DESC', 
      event_id,
      employee_no,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const where = {};
    if (event_id) where.event_id = Number(event_id);
    if (employee_no) {
      where.employee_no = { [Op.iLike]: `%${employee_no}%` };
    }
    if (search) {
      where[Op.or] = [
        { employee_name: { [Op.iLike]: `%${search}%` } },
        { employee_no: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const include = [{
      model: Event,
      attributes: ['event_id', 'event_name']
    }];
    
    const { count, rows } = await Registration.findAndCountAll({
      where,
      include,
      order: [[sort, order.toUpperCase()]],
      limit: Number(limit),
      offset
    });
    
    res.json({
      registrations: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    console.error('GET /registrations error:', e);
    next(e);
  }
});

// GET /registrations/template - Download Excel template
registrationsRouter.get('/template', requireAuth, async (req, res, next) => {
  try {
    // Fetch all events for reference sheet
    const events = await Event.findAll({ attributes: ['event_id', 'event_name'] });

    // Create main template sheet
    const templateData = [
      ['Employee No', 'Employee Name', 'Department', 'Event Name'], // Headers
      ['EMP001', 'John Doe', 'IT', 'Sample Event'] // Sample row
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Create events reference sheet
    const eventsData = [['Event ID', 'Event Name']];
    events.forEach(event => eventsData.push([event.event_id, event.event_name]));
    const eventsWs = XLSX.utils.aoa_to_sheet(eventsData);

    // Bundle into workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations Template');
    XLSX.utils.book_append_sheet(wb, eventsWs, 'Events Reference');

    // Write and send as download
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations-template.xlsx');
    res.send(buffer);
  } catch (e) {
    console.error('GET /registrations/template error:', e);
    next(e);
  }
});

// POST /registrations - Create new registration
registrationsRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').isString().notEmpty().trim(),
    body('department').optional().isString().trim(),
    body('event_id').isInt({ min: 1 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { event_id, employee_no, employee_name, department } = req.body;
      const finalEmployeeNo = employee_no?.trim() || null;
      
      // Duplicate check: employee_no + event_id OR employee_name + event_id (case-insensitive for name)
      const existing = await Registration.findOne({
        where: {
          event_id: Number(event_id),
          [Op.or]: [
            finalEmployeeNo ? { employee_no: finalEmployeeNo } : null,
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('employee_name')),
              sequelize.fn('LOWER', employee_name.trim())
            )
          ].filter(Boolean)
        }
      });
      
      if (existing) {
        return res.status(409).json({ 
          error: 'Duplicate registration found',
          details: `Registration for "${employee_name.trim()}" in event ${event_id} already exists`
        });
      }
      
      const created = await Registration.create({
        employee_no: finalEmployeeNo,
        employee_name: employee_name.trim(),
        department: department?.trim() || null,
        event_id: Number(event_id)
      });
      
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate registration', details: 'Unique constraint violated' });
      }
      next(e);
    }
  }
);

// PUT /registrations/:id - Update registration
registrationsRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('event_id').optional().isInt({ min: 1 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      const registration = await Registration.findByPk(req.params.id);
      if (!registration) return res.status(404).json({ error: 'Registration not found' });
      
      const { event_id, employee_no, employee_name, department } = req.body;
      const updateData = {
        ...(employee_name && { employee_name: employee_name.trim() }),
        ...(employee_no && { employee_no: employee_no.trim() }),
        ...(department && { department: department.trim() }),
        ...(event_id && { event_id: Number(event_id) })
      };
      
      // Duplicate check excluding self (case-insensitive for name)
      const existing = await Registration.findOne({
        where: {
          ...updateData,
          reg_id: { [Op.ne]: req.params.id },
          [Op.or]: [
            updateData.employee_no ? { employee_no: updateData.employee_no } : null,
            updateData.employee_name ? sequelize.where(
              sequelize.fn('LOWER', sequelize.col('employee_name')),
              sequelize.fn('LOWER', updateData.employee_name)
            ) : null
          ].filter(Boolean)
        }
      });
      
      if (existing) {
        return res.status(409).json({ error: 'Duplicate registration found' });
      }
      
      await registration.update(updateData);
      res.json(registration);
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /registrations/:id
registrationsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const registration = await Registration.findByPk(req.params.id);
    if (!registration) return res.status(404).json({ error: 'Registration not found' });
    await registration.destroy();
    res.json({ message: 'Registration deleted successfully' });
  } catch (e) {
    next(e);
  }
});

// POST /registrations/upload - Excel upload with parsing, in-file + DB duplicate checks, and skipping
registrationsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    const created = [];
    const skipped = [];
    const seen = new Map(); // Track in-file duplicates: employee_no_event_id or lowercase_name_event_id
    
    for (const row of rows) {
      const rawEmployeeNo = (row['Employee No'] || '').toString().trim();
      const rawEmployeeName = (row['Employee Name'] || '').toString().trim();
      const rawDepartment = (row['Department'] || '').toString().trim();
      const event_name = (row['Event Name'] || '').toString().trim();
      
      if (!rawEmployeeName || rawEmployeeName.length < 2) {
        skipped.push({ ...row, reason: 'Invalid or missing Employee Name' });
        continue;
      }
      
      // Find event by name (case-insensitive)
      const event = await Event.findOne({
        where: sequelize.where(
          sequelize.fn('LOWER', sequelize.col('event_name')),
          sequelize.fn('LOWER', event_name)
        )
      });
      
      if (!event) {
        skipped.push({ ...row, reason: `Event "${event_name}" not found` });
        continue;
      }
      
      const finalEmployeeNo = rawEmployeeNo || null; // null for walk-ins
      const key = finalEmployeeNo 
        ? `${finalEmployeeNo}_${event.event_id}` 
        : `NA_${event.event_id}_${rawEmployeeName.toLowerCase()}`;
      
      // Check in-file duplicates first
      if (seen.has(key)) {
        const reason = finalEmployeeNo 
          ? `Duplicate employee "${finalEmployeeNo}" for event "${event_name}" (in file)`
          : `Duplicate walk-in "${rawEmployeeName}" for event "${event_name}" (in file)`;
        skipped.push({ ...row, reason });
        console.warn(`Upload skipping in-file duplicate: ${key}`);
        continue;
      }
      
      // Check DB duplicates
      const existingInDb = await Registration.findOne({
        where: {
          event_id: event.event_id,
          [Op.or]: [
            finalEmployeeNo ? { employee_no: finalEmployeeNo } : null,
            sequelize.where(
              sequelize.fn('LOWER', sequelize.col('employee_name')),
              rawEmployeeName.toLowerCase()
            )
          ].filter(Boolean)
        }
      });
      
      if (existingInDb) {
        const reason = finalEmployeeNo 
          ? `Employee "${finalEmployeeNo}" already registered for event "${event_name}"`
          : `Walk-in "${rawEmployeeName}" already registered for event "${event_name}"`;
        skipped.push({ ...row, reason });
        console.warn(`Upload skipping DB duplicate: ${key}`);
        continue;
      }
      
      // Safe to insert
      seen.set(key, true);
      const record = await Registration.create({
        employee_no: finalEmployeeNo,
        employee_name: rawEmployeeName,
        department: rawDepartment || null,
        event_id: event.event_id,
      });
      created.push(record);
    }
    
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped;
    }
    console.log(`Upload completed: ${response.inserted} inserted, ${response.skipped || 0} skipped`);
    res.json(response);
  } catch (e) {
    console.error('POST /registrations/upload error:', e);
    next(e);
  }
});

// GET /registrations/departments - Existing route for departments (unchanged)
registrationsRouter.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const departments = await sequelize.query(
      `SELECT DISTINCT department as department FROM dmags WHERE department IS NOT NULL ORDER BY department`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.json(departments.map(d => d.department).filter(Boolean));
  } catch (e) {
    console.error('GET /registrations/departments error:', e);
    next(e);
  }
});

// GET /registrations/export - Export filtered data as XLSX
registrationsRouter.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { event_id, search } = req.query;
    
    const where = {};
    if (event_id) where.event_id = Number(event_id);
    if (search) {
      where[Op.or] = [
        { employee_name: { [Op.iLike]: `%${search}%` } },
        { employee_no: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const include = [{
      model: Event,
      attributes: ['event_name']
    }];
    
    const records = await Registration.findAll({
      where,
      include,
      order: [['reg_id', 'ASC']]
    });
    
    // Prepare data for XLSX (CSV-like: flat array of arrays)
    const data = [
      ['ID', 'Employee No', 'Employee Name', 'Department', 'Event Name'], // Headers
      ...records.map(r => [
        r.reg_id,
        r.employee_no || '',
        r.employee_name,
        r.department || '',
        r.event?.event_name || ''
      ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations-export.xlsx');
    res.send(buffer);
  } catch (e) {
    console.error('GET /registrations/export error:', e);
    next(e);
  }
});