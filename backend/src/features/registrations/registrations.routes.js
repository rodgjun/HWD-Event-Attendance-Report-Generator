import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { Registration, Event } from '../../core/models.js';
import { sequelize } from '../../core/db.js';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';

const upload = multer({ storage: multer.memoryStorage() });
export const registrationsRouter = Router();

registrationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'reg_id', 
      order = 'DESC', 
      event_id,
      employee_no,
      employee_name,
      department,
      event_name
    } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (event_id) where.event_id = event_id;
    if (employee_no) {
      where.employee_no = sequelize.where(
        sequelize.fn('LOWER', sequelize.col('employee_no')),
        { [Op.like]: `%${employee_no.toLowerCase()}%` }
      );
    }
    if (employee_name) {
      where.employee_name = sequelize.where(
        sequelize.fn('LOWER', sequelize.col('employee_name')),
        { [Op.like]: `%${employee_name.toLowerCase()}%` }
      );
    }
    if (department) {
      where.department = sequelize.where(
        sequelize.fn('LOWER', sequelize.col('department')),
        { [Op.like]: `%${department.toLowerCase()}%` }
      );
    }
    
    const includeWhere = {};
    if (event_name) {
      includeWhere.event_name = sequelize.where(
        sequelize.fn('LOWER', sequelize.col('event_name')),
        { [Op.like]: `%${event_name.toLowerCase()}%` }
      );
    }
    
    const { count, rows } = await Registration.findAndCountAll({
      where,
      include: [{
        model: Event,
        where: Object.keys(includeWhere).length > 0 ? includeWhere : undefined,
        required: Object.keys(includeWhere).length > 0
      }],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      registrations: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    console.error('GET /registrations error:', e);
    next(e);
  }
});

registrationsRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),  // Allow empty/undefined; handle in code
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('event_name').isString().notEmpty().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('POST /registrations validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { event_name, employee_no, ...rest } = req.body;
      const event = await Event.findOne({ where: { event_name } });
      if (!event) {
        console.error(`POST /registrations: Event "${event_name}" not found`);
        return res.status(404).json({ error: 'Event not found', details: `Event "${event_name}" does not exist` });
      }
      
      const finalEmployeeNo = (employee_no === '' || employee_no === undefined || employee_no === null) ? 'NA' : employee_no.trim();

      // Conditional duplicate check
      let existingRegistration;
      if (finalEmployeeNo === 'NA') {
        // For NA: Check employee_name + event_id (case-insensitive)
        existingRegistration = await Registration.findOne({
          where: {
            employee_no: 'NA',
            event_id: event.event_id,
            employee_name: { [Op.iLike]: rest.employee_name?.trim() || '' }  // Assumes employee_name in rest
          }
        });
      } else {
        // For actual employee_no: Standard check
        existingRegistration = await Registration.findOne({
          where: {
            employee_no: finalEmployeeNo,
            event_id: event.event_id
          }
        });
      }

      if (existingRegistration) {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: finalEmployeeNo === 'NA' 
            ? `Employee "${rest.employee_name?.trim() || 'unknown'}" is already registered for this event` 
            : `Employee ${finalEmployeeNo} is already registered for this event` 
        });
      }
      
      const created = await Registration.create({
        ...rest,
        employee_no: finalEmployeeNo,
        event_id: event.event_id
      });
      res.status(201).json(created);
    } catch (e) {
      console.error('POST /registrations error:', e);
      next(e);
    }
  }
);

// PUT validation and logic (similar changes)
registrationsRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().trim(),  // Allow empty/undefined
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('event_name').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('PUT /registrations/:id validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      const id = parseInt(req.params.id, 10);  // Parse to int to avoid Op.ne issues
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID', details: 'Registration ID must be a number' });
      }
      const registration = await Registration.findByPk(id);
      if (!registration) {
        console.error(`PUT /registrations/${id}: Registration not found`);
        return res.status(404).json({ error: 'Registration not found', details: `ID ${id} does not exist` });
      }
      
      const { event_name, employee_no, ...rest } = req.body;
      let event_id = registration.event_id;
      if (event_name) {
        const event = await Event.findOne({ where: { event_name } });
        if (!event) {
          console.error(`PUT /registrations/${id}: Event "${event_name}" not found`);
          return res.status(404).json({ error: 'Event not found', details: `Event "${event_name}" does not exist` });
        }
        event_id = event.event_id;
      }
      
      const finalEmployeeNo = (employee_no === '' || employee_no === undefined || employee_no === null) ? 'NA' : employee_no.trim();

      // Conditional duplicate check
      let existingRegistration;
      if (finalEmployeeNo === 'NA') {
        // For NA: Check employee_name + event_id (case-insensitive)
        existingRegistration = await Registration.findOne({
          where: {
            employee_no: 'NA',
            event_id: event.event_id,
            employee_name: { [Op.iLike]: rest.employee_name?.trim() || '' }  // Assumes employee_name in rest
          }
        });
      } else {
        // For actual employee_no: Standard check
        existingRegistration = await Registration.findOne({
          where: {
            employee_no: finalEmployeeNo,
            event_id: event.event_id
          }
        });
      }

      if (existingRegistration) {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: finalEmployeeNo === 'NA' 
            ? `Employee "${rest.employee_name?.trim() || 'unknown'}" is already registered for this event` 
            : `Employee ${finalEmployeeNo} is already registered for this event` 
        });
      }
      
      await registration.update({ ...rest, employee_no: finalEmployeeNo, event_id });
      res.json(registration);
    } catch (e) {
      console.error(`PUT /registrations/${req.params.id} error:`, e);
      next(e);
    }
  }
);

registrationsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const registration = await Registration.findByPk(req.params.id);
    if (!registration) {
      console.error(`DELETE /registrations/${req.params.id}: Registration not found`);
      return res.status(404).json({ error: 'Registration not found', details: `ID ${req.params.id} does not exist` });
    }
    await registration.destroy();
    res.json({ message: 'Registration deleted successfully' });
  } catch (e) {
    console.error(`DELETE /registrations/${req.params.id} error:`, e);
    next(e);
  }
});

registrationsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) {
      console.error('POST /registrations/upload: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded', details: 'Please select a valid Excel/CSV file' });
    }
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const created = [];
    const skipped = [];
    
    // Track unique keys conditionally
    const seen = new Map();
    
    for (const row of rows) {
      let employee_no = row['Employee No']?.toString().trim();
      const rawEmployeeName = row['Employee Name']?.toString().trim();
      const event_name = row['Event Name']?.toString().trim();
      
      if (!event_name) {
        skipped.push({ ...row, reason: 'Missing Event Name' });
        console.warn(`Upload skipping row: Missing Event Name`);
        continue;
      }
      
      const event = await Event.findOne({ where: { event_name } });
      if (!event) {
        skipped.push({ ...row, reason: `Event "${event_name}" not found` });
        console.warn(`Upload skipping row: Event "${event_name}" not found`);
        continue;
      }
      
      // Handle empty employee_no → 'NA'
      const finalEmployeeNo = (employee_no === '' || !employee_no) ? 'NA' : employee_no;
      
      // Conditional duplicate key
      let key;
      if (finalEmployeeNo === 'NA') {
        if (!rawEmployeeName) {
          skipped.push({ ...row, reason: 'Employee Name required for walk-in (no Employee No)' });
          console.warn(`Upload skipping row: Missing Employee Name for walk-in`);
          continue;
        }
        key = `NA_${event.event_id}_${rawEmployeeName.toLowerCase()}`;
      } else {
        key = `${finalEmployeeNo}_${event.event_id}`;
      }
      
      if (seen.has(key)) {
        const reason = finalEmployeeNo === 'NA' 
          ? `Duplicate walk-in "${rawEmployeeName}" for event "${event_name}"`
          : `Duplicate employee "${finalEmployeeNo}" for event "${event_name}"`;
        skipped.push({ ...row, reason });
        console.warn(`Upload skipping duplicate: ${key}`);
        continue;
      }
      seen.set(key, true);
      
      const record = await Registration.create({
        employee_no: finalEmployeeNo,
        employee_name: rawEmployeeName || null,
        department: row['Department']?.toString().trim() || null,
        event_id: event.event_id,
      });
      created.push(record);
    }
    
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped; // For debugging; remove in production if sensitive
    }
    console.log(`Upload completed: ${response.inserted} inserted, ${response.skipped || 0} skipped`);
    res.json(response);
  } catch (e) {
    console.error('POST /registrations/upload error:', e);
    next(e);
  }
});


// Add after the existing routes
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