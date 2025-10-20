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
  if (!employeeNo || employeeNo === 'NA') return 'Not Registered'; // 'NA' or null can't be registered
  const employeeNoStr = String(employeeNo);
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
    console.error('GET /attendance error:', e);
    next(e);
  }
});

attendanceRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),  // Relaxed for empty/NA
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
      
      const { event_name, employee_no, employee_name: empName, ...rest } = req.body;
      const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
      if (!event) {
        console.error(`POST /attendance: Event "${event_name}" not found`);
        return res.status(404).json({ error: `Event "${event_name}" not found`, details: `Event "${event_name}" does not exist` });
      }
      
      // Handle empty employee_no → 'NA'
      const finalEmployeeNo = (employee_no === '' || employee_no === undefined || employee_no === null) ? 'NA' : employee_no.trim();
      
      // Conditional duplicate check
      let existingAttendance;
      if (finalEmployeeNo === 'NA') {
        if (!empName?.trim()) {
          return res.status(400).json({ error: 'Employee Name required for walk-in attendance' });
        }
        existingAttendance = await Attendance.findOne({
          where: {
            employee_no: 'NA',
            event_id: event.event_id,
            employee_name: { [Op.iLike]: empName.trim() }
          }
        });
      } else {
        existingAttendance = await Attendance.findOne({
          where: {
            employee_no: finalEmployeeNo,
            event_id: event.event_id
          }
        });
      }
      
      if (existingAttendance) {
        console.warn(`POST /attendance: Duplicate found for employee ${finalEmployeeNo || 'NULL'} in event ${event_name}`);
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: finalEmployeeNo === 'NA' 
            ? `Employee "${empName.trim()}" already has attendance for "${event_name}"` 
            : `Employee ${finalEmployeeNo} already has attendance for "${event_name}"` 
        });
      }
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event.event_id);
      const created = await Attendance.create({ 
        ...rest, 
        employee_no: finalEmployeeNo, 
        employee_name: empName?.trim() || null,
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
    body('employee_no').optional().trim(),
    body('employee_name').optional().isString().trim(),
    body('department').optional().isString().trim(),
    body('mode_of_attendance').isIn(['Virtual', 'Onsite']),
    body('event_name').optional().isString().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('PUT /attendance/:id validation errors:', errors.array());
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID', details: 'Attendance ID must be a number' });
      }
      const attendance = await Attendance.findByPk(id);
      if (!attendance) {
        console.error(`PUT /attendance/${id}: Attendance not found`);
        return res.status(404).json({ error: 'Attendance record not found', details: `ID ${id} does not exist` });
      }
      
      const { event_name, employee_no, employee_name: empName, ...rest } = req.body;
      let event_id = attendance.event_id;
      if (event_name) {
        const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
        if (!event) {
          console.error(`PUT /attendance/${id}: Event "${event_name}" not found`);
          return res.status(404).json({ error: 'Event not found', details: `Event "${event_name}" does not exist` });
        }
        event_id = event.event_id;
      }
      
      // Handle empty employee_no → 'NA'
      const finalEmployeeNo = (employee_no === '' || employee_no === undefined || employee_no === null) ? 'NA' : employee_no.trim();
      
      // Conditional duplicate check (excluding current)
      let existingAttendance;
      if (finalEmployeeNo === 'NA') {
        if (!empName?.trim()) {
          return res.status(400).json({ error: 'Employee Name required for walk-in attendance' });
        }
        existingAttendance = await Attendance.findOne({
          where: {
            employee_no: 'NA',
            event_id,
            employee_name: { [Op.iLike]: empName.trim() },
            attendance_id: { [Op.ne]: id }
          }
        });
      } else {
        existingAttendance = await Attendance.findOne({
          where: {
            employee_no: finalEmployeeNo,
            event_id,
            attendance_id: { [Op.ne]: id }
          }
        });
      }
      
      if (existingAttendance) {
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: finalEmployeeNo === 'NA' 
            ? `Employee "${empName.trim()}" already has attendance for this event` 
            : `Employee ${finalEmployeeNo} already has attendance for this event` 
        });
      }
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event_id);
      await attendance.update({ 
        ...rest, 
        employee_no: finalEmployeeNo, 
        employee_name: empName?.trim() || null,
        event_id, 
        validation_status 
      });
      res.json(attendance);
    } catch (e) {
      console.error(`PUT /attendance/${req.params.id} error:`, e);
      next(e);
    }
  }
);

attendanceRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID', details: 'Attendance ID must be a number' });
    }
    const attendance = await Attendance.findByPk(id);
    if (!attendance) {
      console.error(`DELETE /attendance/${id}: Attendance not found`);
      return res.status(404).json({ error: 'Attendance record not found', details: `ID ${id} does not exist` });
    }
    await attendance.destroy();
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (e) {
    console.error(`DELETE /attendance/${req.params.id} error:`, e);
    next(e);
  }
});

attendanceRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) {
      console.error('POST /attendance/upload: No file uploaded');
      return res.status(400).json({ error: 'No file uploaded', details: 'Please select a valid Excel/CSV file' });
    }
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const created = [];
    const skipped = [];
    
    const seen = new Map();
    
    for (const row of rows) {
      let employee_no = row['Employee No']?.toString().trim();
      const rawEmployeeName = row['Employee Name']?.toString().trim();
      const event_name = row['Event Name']?.toString().trim();
      const mode_of_attendance = row['Mode of Attendance']?.toString().trim() || 'Virtual';
      
      if (!event_name) {
        skipped.push({ ...row, reason: 'Missing Event Name' });
        console.warn('Upload skipping row: Missing Event Name');
        continue;
      }
      if (!['Virtual', 'Onsite'].includes(mode_of_attendance)) {
        skipped.push({ ...row, reason: `Invalid Mode of Attendance "${mode_of_attendance}"` });
        console.warn(`Upload skipping row: Invalid Mode of Attendance "${mode_of_attendance}"`);
        continue;
      }
      
      const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
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
      
      const validation_status = await computeValidationStatus(finalEmployeeNo, event.event_id);
      const record = await Attendance.create({
        employee_no: finalEmployeeNo,
        employee_name: rawEmployeeName || null,
        department: row['Department']?.toString().trim() || null,
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
    }
    console.log(`Upload completed: ${response.inserted} inserted, ${response.skipped || 0} skipped`);
    res.json(response);
  } catch (e) {
    console.error('POST /attendance/upload error:', e);
    next(e);
  }
});

// New endpoint for departments autocomplete
attendanceRouter.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const departments = await sequelize.query(
      `SELECT DISTINCT department as department FROM dmags WHERE department IS NOT NULL ORDER BY department`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.json(departments.map(d => d.department).filter(Boolean));
  } catch (e) {
    console.error('GET /attendance/departments error:', e);
    next(e);
  }
});