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
  const match = await Registration.findOne({ where: { employee_no: employeeNo, event_id: eventId } });
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
    body('employee_no').optional().isString(),
    body('employee_name').optional().isString(),
    body('department').optional().isString(),
    body('mode_of_attendance').isIn(['Virtual', 'Onsite']),
    body('event_id').isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      // Check for duplicate attendance
      const existingAttendance = await Attendance.findOne({
        where: {
          employee_no: req.body.employee_no,
          event_id: req.body.event_id
        }
      });
      
      if (existingAttendance) {
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: `Employee ${req.body.employee_no || req.body.employee_name} already has attendance recorded for this event` 
        });
      }
      
      const { employee_no, event_id } = req.body;
      const validation_status = await computeValidationStatus(employee_no, event_id);
      const created = await Attendance.create({ ...req.body, validation_status });
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'Duplicate attendance found', 
          details: 'This employee already has attendance recorded for this event' 
        });
      }
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
    body('event_id').isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const attendance = await Attendance.findByPk(req.params.id);
      if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
      const { employee_no, event_id } = req.body;
      const validation_status = await computeValidationStatus(employee_no, event_id);
      await attendance.update({ ...req.body, validation_status });
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
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    let inserted = 0;
    for (const row of rows) {
      const eventId = Number(row['Event ID']);
      const employeeNo = row['Employee No'] || null;
      const validation_status = await computeValidationStatus(employeeNo, eventId);
      await Attendance.create({
        employee_no: employeeNo,
        employee_name: row['Employee Name'] || null,
        department: row['Department'] || null,
        mode_of_attendance: row['Mode of Attendance'] || 'Virtual',
        event_id: eventId,
        validation_status,
      });
      inserted += 1;
    }
    res.json({ inserted });
  } catch (e) {
    next(e);
  }
});



