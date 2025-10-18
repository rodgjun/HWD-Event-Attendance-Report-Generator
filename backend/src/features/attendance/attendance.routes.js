import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { Attendance, Registration, Event } from '../../core/models.js';
import { sequelize } from '../../core/db.js';
import { Op } from 'sequelize';
import { requireAuth } from '../_shared/auth-middleware.js';

const upload = multer({ storage: multer.memoryStorage() });
export const attendanceRouter = Router();

async function computeValidationStatus(employeeNo, eventId) {
  if (!employeeNo) return 'Not Registered'; // NULL employee_no can't be registered
  const employeeNoStr = String(employeeNo); // Explicitly cast to string
  const match = await Registration.findOne({ 
    where: { 
      employee_no: employeeNoStr, 
      event_id: eventId 
    } 
  });
  return match ? 'Registered' : 'Not Registered';
}

attendanceRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'attendance_id', 
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
    if (employee_no) where.employee_no = { [Op.like]: `%${employee_no}%` };
    if (employee_name) where.employee_name = { [Op.like]: `%${employee_name}%` };
    if (department) where.department = { [Op.like]: `%${department}%` };

    // For event_name (in includeWhere)
    const includeWhere = {};
    if (event_name) includeWhere.event_name = { [Op.like]: `%${event_name}%` };
    
    const { count, rows } = await Attendance.findAndCountAll({
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
      attendance: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    next(e);
  }
});

attendanceRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().isString().trim(),
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('mode_of_attendance').isIn(['Virtual', 'Onsite']).withMessage('Mode must be Virtual or Onsite'),
    body('event_name').isString().notEmpty().trim().withMessage('Event Name is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('POST /attendance validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { event_name, employee_no, ...rest } = req.body;
      const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
      if (!event) {
        console.error(`POST /attendance: Event "${event_name}" not found`);
        return res.status(404).json({ error: `Event "${event_name}" not found` });
      }
      
      const finalEmployeeNo = employee_no === '' || employee_no === undefined ? null : employee_no;

      const existingAttendance = await Attendance.findOne({
        where: {
          employee_no: finalEmployeeNo,
          event_id: event.event_id
        }
      });
      
      if (existingAttendance) {
        console.warn(`POST /attendance: Duplicate found for employee ${finalEmployeeNo || 'NULL'} in event ${event_name}`);
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: `Employee ${finalEmployeeNo || rest.employee_name || 'unknown'} already has attendance for "${event_name}"` 
        });
      }
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event.event_id);
      const created = await Attendance.create({ 
        ...rest, 
        employee_no: finalEmployeeNo, 
        event_id: event.event_id, 
        validation_status 
      });
      res.status(201).json(created);
    } catch (e) {
      console.error('POST /attendance error:', e);
      next(e);
    }
  }
);

attendanceRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().isString(),
    body('employee_name').optional().isString(),
    body('department').optional().isString(),
    body('mode_of_attendance').isIn(['Virtual', 'Onsite']),
    body('event_name').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const attendance = await Attendance.findByPk(req.params.id);
      if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
      
      const { event_name, employee_no, ...rest } = req.body;
      let event_id = attendance.event_id;
      if (event_name) {
        const event = await Event.findOne({ where: { event_name } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        event_id = event.event_id;
      }
      
      // Handle empty employee_no
      const finalEmployeeNo = employee_no === '' ? null : employee_no;

      // Check for duplicate (excluding current)
      const existingAttendance = await Attendance.findOne({
        where: {
          employee_no: finalEmployeeNo,
          event_id,
          attendance_id: { [Op.ne]: req.params.id }
        }
      });
      
      if (existingAttendance) {
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: `Employee ${finalEmployeeNo || rest.employee_name} already has attendance recorded for this event` 
        });
      }
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event_id);
      await attendance.update({ ...rest, employee_no: finalEmployeeNo, event_id, validation_status });
      res.json(attendance);
    } catch (e) {
      next(e);
    }
  }
);

attendanceRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
    await attendance.destroy();
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (e) {
    next(e);
  }
});

attendanceRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) {
      console.error('POST /attendance/upload: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const created = [];
    const skipped = [];
    
    const seen = new Map();
    
    for (const row of rows) {
      const employee_no = row['Employee No'] === '' ? null : String(row['Employee No']); // Cast to string
      const event_name = row['Event Name'];
      const mode_of_attendance = row['Mode of Attendance'] || 'Virtual';
      
      if (!event_name) {
        skipped.push({ ...row, reason: 'Missing Event Name' });
        console.warn('Skipping row: Missing Event Name');
        continue;
      }
      if (!['Virtual', 'Onsite'].includes(mode_of_attendance)) {
        skipped.push({ ...row, reason: `Invalid Mode of Attendance "${mode_of_attendance}"` });
        console.warn(`Skipping row: Invalid Mode of Attendance "${mode_of_attendance}"`);
        continue;
      }
      
      const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
      if (!event) {
        skipped.push({ ...row, reason: `Event "${event_name}" not found` });
        console.warn(`Skipping row: Event "${event_name}" not found`);
        continue;
      }
      
      const key = `${employee_no || 'NULL'}_${event.event_id}`;
      if (seen.has(key)) {
        skipped.push({ ...row, reason: `Duplicate employee ${employee_no || 'NULL'} for event ${event_name}` });
        console.warn(`Skipping duplicate: ${key}`);
        continue;
      }
      seen.set(key, true);
      
      const validation_status = await computeValidationStatus(employee_no, event.event_id);
      const record = await Attendance.create({
        employee_no,
        employee_name: row['Employee Name'] || null,
        department: row['Department'] || null,
        mode_of_attendance,
        event_id: event.event_id,
        validation_status,
      });
      created.push(record);
    }
    
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped; // For debugging
      console.log('POST /attendance/upload: Skipped rows:', skipped);
    }
    res.json(response);
  } catch (e) {
    console.error('POST /attendance/upload error:', e);
    next(e);
  }
});



