import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js';
import { Attendance, Event, Registration } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';

const upload = multer({ storage: multer.memoryStorage() });
export const attendanceRouter = Router();

// Helper to compute validation status
async function computeValidationStatus(employeeNo, eventId) {
  if (!employeeNo || employeeNo === 'NA') return 'Not Registered';
  const match = await Registration.findOne({
    where: { employee_no: String(employeeNo), event_id: eventId }
  });
  return match ? 'Registered' : 'Not Registered';
}

// GET /attendance - Paginated list with unified case-insensitive search and filters
attendanceRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'attendance_id', 
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
    
    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include,
      order: [[sort, order.toUpperCase()]],
      limit: Number(limit),
      offset
    });
    
    res.json({
      attendance: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    console.error('GET /attendance error:', e);
    next(e);
  }
});

// GET /attendance/template - Download Excel template
attendanceRouter.get('/template', requireAuth, async (req, res, next) => {
  try {
    // Fetch all events for reference sheet
    const events = await Event.findAll({ attributes: ['event_id', 'event_name'] });

    // Create main template sheet
    const templateData = [
      ['Employee No', 'Employee Name', 'Department', 'Mode of Attendance', 'Event Name'], // Headers
      ['EMP001', 'John Doe', 'IT', 'Onsite', 'Sample Event'] // Sample row
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Create events reference sheet
    const eventsData = [['Event ID', 'Event Name']];
    events.forEach(event => eventsData.push([event.event_id, event.event_name]));
    const eventsWs = XLSX.utils.aoa_to_sheet(eventsData);

    // Bundle into workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Template');
    XLSX.utils.book_append_sheet(wb, eventsWs, 'Events Reference');

    // Write and send as download
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-template.xlsx');
    res.send(buffer);
  } catch (e) {
    console.error('GET /attendance/template error:', e);
    next(e);
  }
});

// POST /attendance - Create new attendance
attendanceRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('mode_of_attendance').isIn(['Virtual', 'Onsite']),
    body('event_id').optional().isInt({ min: 1 }),
    body('event_name').optional().isString().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      let { event_id, event_name, employee_no, employee_name, department, mode_of_attendance } = req.body;
      const finalEmployeeNo = employee_no?.trim() || null;
      const finalEmployeeName = employee_name?.trim() || null;
      
      // Resolve event_id if event_name provided
      if (event_name && !event_id) {
        const event = await Event.findOne({ where: { event_name: event_name.trim() } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        event_id = event.event_id;
      }
      if (!event_id) return res.status(400).json({ error: 'Event ID or Name required' });

      // Require name for walk-ins
      if (!finalEmployeeNo && !finalEmployeeName) {
        return res.status(400).json({ error: 'Employee Name required for walk-ins' });
      }

      // Duplicate check: employee_no + event_id OR employee_name + event_id (case-insensitive for name)
      const orConditions = [];
      if (finalEmployeeNo) orConditions.push({ employee_no: finalEmployeeNo });
      if (finalEmployeeName) {
        orConditions.push(sequelize.where(
          sequelize.fn('LOWER', sequelize.col('employee_name')),
          sequelize.fn('LOWER', finalEmployeeName)
        ));
      }
      const existing = await Attendance.findOne({
        where: {
          event_id: Number(event_id),
          [Op.or]: orConditions
        }
      });
      
      if (existing) {
        return res.status(409).json({ 
          error: 'Duplicate attendance found',
          details: `Attendance for "${finalEmployeeName || finalEmployeeNo}" in event ${event_id} already exists`
        });
      }
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event_id);
      
      const created = await Attendance.create({
        employee_no: finalEmployeeNo,
        employee_name: finalEmployeeName,
        department: department?.trim() || null,
        mode_of_attendance,
        validation_status,
        event_id: Number(event_id)
      });
      
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate attendance', details: 'Unique constraint violated' });
      }
      next(e);
    }
  }
);

// PUT /attendance/:id - Update attendance
attendanceRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('mode_of_attendance').optional().isIn(['Virtual', 'Onsite']),
    body('event_id').optional().isInt({ min: 1 }),
    body('event_name').optional().isString().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      const attendance = await Attendance.findByPk(req.params.id);
      if (!attendance) return res.status(404).json({ error: 'Attendance not found' });
      
      let { event_id, event_name, employee_no, employee_name, department, mode_of_attendance } = req.body;
      const updateData = {};
      
      if (event_name) {
        const event = await Event.findOne({ where: { event_name: event_name.trim() } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        event_id = event.event_id;
      }
      if (event_id) updateData.event_id = Number(event_id);
      
      const finalEmployeeNo = employee_no?.trim() || null;
      const finalEmployeeName = employee_name?.trim() || null;
      
      // Require name for walk-ins
      if (!finalEmployeeNo && !finalEmployeeName) {
        return res.status(400).json({ error: 'Employee Name required for walk-ins' });
      }

      if (finalEmployeeNo !== undefined) updateData.employee_no = finalEmployeeNo;
      if (finalEmployeeName !== undefined) updateData.employee_name = finalEmployeeName;
      if (department !== undefined) updateData.department = department?.trim() || null;
      if (mode_of_attendance) updateData.mode_of_attendance = mode_of_attendance;

      // Duplicate check excluding self
      const orConditions = [];
      if (updateData.employee_no) orConditions.push({ employee_no: updateData.employee_no });
      if (updateData.employee_name) {
        orConditions.push(sequelize.where(
          sequelize.fn('LOWER', sequelize.col('employee_name')),
          sequelize.fn('LOWER', updateData.employee_name)
        ));
      }
      if (orConditions.length > 0) {
        const existing = await Attendance.findOne({
          where: {
            event_id: updateData.event_id || attendance.event_id,
            [Op.or]: orConditions,
            attendance_id: { [Op.ne]: req.params.id }
          }
        });
        if (existing) return res.status(409).json({ error: 'Duplicate attendance found' });
      }
      
      // Recompute validation status if employee_no or event_id changed
      const newEmployeeNo = updateData.employee_no !== undefined ? updateData.employee_no : attendance.employee_no;
      const newEventId = updateData.event_id || attendance.event_id;
      updateData.validation_status = await computeValidationStatus(newEmployeeNo, newEventId);
      
      await attendance.update(updateData);
      res.json(attendance);
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /attendance/:id
attendanceRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) return res.status(404).json({ error: 'Attendance not found' });
    await attendance.destroy();
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /attendance/:id error:', e);
    next(e);
  }
});

// POST /attendance/bulk-delete
attendanceRouter.post('/bulk-delete', requireAuth, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty IDs array' });
    }
    await Attendance.destroy({ where: { attendance_id: { [Op.in]: ids } } });
    res.status(204).send();
  } catch (e) {
    console.error('POST /attendance/bulk-delete error:', e);
    next(e);
  }
});

// POST /attendance/upload - Bulk upload from Excel
attendanceRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    
    if (rows.length < 2) return res.status(400).json({ error: 'Empty or invalid sheet' });
    
    const headers = rows[0].map(h => h.toString().trim().toLowerCase());
    const requiredHeaders = ['employee no', 'employee name', 'department', 'mode of attendance', 'event name'];
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) return res.status(400).json({ error: `Missing header: ${req}` });
    }
    
    const created = [];
    const skipped = [];
    const seen = new Map(); // key: employee_no_event_id or NA_event_id_name_lower
    
    for (let i = 1; i < rows.length; i++) {
      const row = {};
      headers.forEach((h, idx) => row[h] = rows[i][idx]?.toString().trim() || '');
      
      const event_name = row['event name'];
      if (!event_name) {
        skipped.push({ ...row, reason: 'Missing Event Name' });
        continue;
      }
      const event = await Event.findOne({ where: { event_name } });
      if (!event) {
        skipped.push({ ...row, reason: `Event "${event_name}" not found` });
        continue;
      }
      
      const mode = row['mode of attendance'].toLowerCase();
      if (!['virtual', 'onsite'].includes(mode)) {
        skipped.push({ ...row, reason: 'Invalid Mode of Attendance (must be Virtual or Onsite)' });
        continue;
      }
      
      let finalEmployeeNo = row['employee no'] || 'NA';
      const rawEmployeeName = row['employee name'];
      if (finalEmployeeNo === 'NA' && !rawEmployeeName) {
        skipped.push({ ...row, reason: 'Employee Name required for walk-ins' });
        continue;
      }
      
      let key;
      if (finalEmployeeNo === 'NA') {
        key = `NA_${event.event_id}_${rawEmployeeName.toLowerCase()}`;
      } else {
        key = `${finalEmployeeNo}_${event.event_id}`;
      }
      
      if (seen.has(key)) {
        const reason = finalEmployeeNo === 'NA' 
          ? `Duplicate walk-in "${rawEmployeeName}" for event "${event_name}"`
          : `Duplicate employee "${finalEmployeeNo}" for event "${event_name}"`;
        skipped.push({ ...row, reason });
        continue;
      }
      seen.set(key, true);

      // --- DB DUPLICATE CHECK (in addition to in-file seen) ---
      const dbWhere = {
        event_id: event.event_id,
        [Op.or]: []
      };
      if (finalEmployeeNo && finalEmployeeNo !== 'NA') {
        dbWhere[Op.or].push({ employee_no: finalEmployeeNo });
      }
      if (rawEmployeeName) {
        dbWhere[Op.or].push(
          sequelize.where(
            sequelize.fn('LOWER', sequelize.col('employee_name')),
            sequelize.fn('LOWER', rawEmployeeName)
          )
        );
      }

      const dbExisting = dbWhere[Op.or].length > 0
        ? await Attendance.findOne({ where: dbWhere })
        : null;

      if (dbExisting) {
        const reason = finalEmployeeNo && finalEmployeeNo !== 'NA'
          ? `Employee ${finalEmployeeNo} already attended "${event_name}"`
          : `Walk-in "${rawEmployeeName}" already recorded for "${event_name}"`;
        skipped.push({ ...row, reason });
        continue;
      }
      // --- END DB CHECK ---
      
      const validation_status = await computeValidationStatus(finalEmployeeNo !== 'NA' ? finalEmployeeNo : null, event.event_id);
      
      const record = await Attendance.create({
        employee_no: finalEmployeeNo !== 'NA' ? finalEmployeeNo : null,
        employee_name: rawEmployeeName || null,
        department: row['department'] || null,
        mode_of_attendance: mode.charAt(0).toUpperCase() + mode.slice(1),
        validation_status,
        event_id: event.event_id
      });
      created.push(record);
    }
    
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped;
    }
    res.json(response);
  } catch (e) {
    console.error('POST /attendance/upload error:', e);
    next(e);
  }
});


// GET /attendance/export - Export filtered attendance as Excel
attendanceRouter.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { event_id, search, sort = 'attendance_id', order = 'DESC' } = req.query;

    const where = {};
    if (event_id) where.event_id = Number(event_id);
    if (search) {
      where[Op.or] = [
        { employee_name: { [Op.iLike]: `%${search}%` } },
        { employee_no: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const rows = await Attendance.findAll({
      where,
      include: [{ model: Event, attributes: ['event_name'] }],
      order: [[sort, order.toUpperCase()]],
      raw: true,
      nest: true
    });

    const data = rows.map(r => ({
      'Attendance ID': r.attendance_id,
      'Employee No': r.employee_no || 'N/A',
      'Employee Name': r.employee_name || 'N/A',
      'Department': r.department || 'N/A',
      'Mode of Attendance': r.mode_of_attendance,
      'Validation Status': r.validation_status,
      'Event Name': r.event?.event_name || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=attendance-export-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    res.send(buffer);
  } catch (e) {
    console.error('GET /attendance/export error:', e);
    next(e);
  }
});