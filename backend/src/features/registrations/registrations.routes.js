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
    if (employee_no) where.employee_no = { [Op.like]: `%${employee_no}%` };
    if (employee_name) where.employee_name = { [Op.like]: `%${employee_name}%` };
    if (department) where.department = { [Op.like]: `%${department}%` };
    
    const includeWhere = {};
    if (event_name) includeWhere.event_name = { [Op.like]: `%${event_name}%` };
    
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
    next(e);
  }
});

registrationsRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().isString(),
    body('employee_name').optional().isString(),
    body('department').optional().isString(),
    body('event_id').isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      // Check for duplicate registration
      const existingRegistration = await Registration.findOne({
        where: {
          employee_no: req.body.employee_no,
          event_id: req.body.event_id
        }
      });
      
      if (existingRegistration) {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: `Employee ${req.body.employee_no || req.body.employee_name} is already registered for this event` 
        });
      }
      
      const created = await Registration.create(req.body);
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: 'This employee is already registered for this event' 
        });
      }
      next(e);
    }
  }
);

registrationsRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().isString(),
    body('employee_name').optional().isString(),
    body('department').optional().isString(),
    body('event_id').isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const registration = await Registration.findByPk(req.params.id);
      if (!registration) return res.status(404).json({ error: 'Registration not found' });
      
      // Check for duplicate registration (excluding current record)
      const existingRegistration = await Registration.findOne({
        where: {
          employee_no: req.body.employee_no,
          event_id: req.body.event_id,
          reg_id: { [sequelize.Op.ne]: req.params.id }
        }
      });
      
      if (existingRegistration) {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: `Employee ${req.body.employee_no || req.body.employee_name} is already registered for this event` 
        });
      }
      
      await registration.update(req.body);
      res.json(registration);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'Duplicate registration found', 
          details: 'This employee is already registered for this event' 
        });
      }
      next(e);
    }
  }
);

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

registrationsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const created = [];
    for (const row of rows) {
      const record = await Registration.create({
        employee_no: row['Employee No'] || null,
        employee_name: row['Employee Name'] || null,
        department: row['Department'] || null,
        event_id: Number(row['Event ID']),
        status: row['Status'] || 'Registered',
      });
      created.push(record);
    }
    res.json({ inserted: created.length });
  } catch (e) {
    next(e);
  }
});

