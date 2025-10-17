import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js';
import { Event } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';

const upload = multer({ storage: multer.memoryStorage() });
export const eventsRouter = Router();

eventsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'event_id', 
      order = 'DESC', 
      type,
      name,
      date
    } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (type) where.event_type = { [sequelize.Op.like]: `%${type}%` };
    if (name) where.event_name = { [sequelize.Op.like]: `%${name}%` };
    if (date) where.event_date = { [sequelize.Op.eq]: date };
    
    const { count, rows } = await Event.findAndCountAll({
      where,
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      events: rows,
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


eventsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { type, name } = req.query;
    const where = {};
    if (type) where.event_type = { [sequelize.Op.like]: `%${type}%` };
    if (name) where.event_name = { [sequelize.Op.like]: `%${name}%` };
    const events = await Event.findAll({ where, order: [['event_name', 'ASC']], raw: true });
    res.json(events.map(e => ({ id: e.event_id, label: `${e.event_type}: ${e.event_name}` })));
  } catch (e) {
    next(e);
  }
});


eventsRouter.post(
  '/',
  requireAuth,
  [
    body('event_type').isString().notEmpty(),
    body('event_name').isString().notEmpty(),
    body('event_date').isDate({ format: 'YYYY-MM-DD' }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      // Check for duplicate event
      const existingEvent = await Event.findOne({
        where: {
          event_type: req.body.event_type,
          event_name: req.body.event_name
        }
      });
      
      if (existingEvent) {
        return res.status(409).json({ 
          error: 'Duplicate event found', 
          details: `Event "${req.body.event_name}" of type "${req.body.event_type}" already exists` 
        });
      }
      
      const created = await Event.create(req.body);
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ 
          error: 'Duplicate event found', 
          details: 'Event type and name combination must be unique' 
        });
      }
      next(e);
    }
  }
);

eventsRouter.put(
  '/:id',
  requireAuth,
  [
    body('event_type').optional().isString(),
    body('event_name').optional().isString(),
    body('event_date').optional().isDate({ format: 'YYYY-MM-DD' }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const event = await Event.findByPk(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      // Check for duplicate (excluding current)
      const existingEvent = await Event.findOne({
        where: {
          event_type: req.body.event_type || event.event_type,
          event_name: req.body.event_name || event.event_name,
          event_id: { [sequelize.Op.ne]: req.params.id }
        }
      });
      
      if (existingEvent) {
        return res.status(409).json({ 
          error: 'Duplicate event found', 
          details: `Event "${req.body.event_name || event.event_name}" of type "${req.body.event_type || event.event_type}" already exists` 
        });
      }
      
      await event.update(req.body);
      res.json(event);
    } catch (e) {
      next(e);
    }
  }
);

eventsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    await event.destroy();
    res.json({ message: 'Event deleted successfully' });
  } catch (e) {
    next(e);
  }
});

// Helper to parse Excel/CSV dates (handles string, number, empty)
function parseExcelDate(cell) {
  if (!cell) return new Date();

  if (typeof cell === 'string') {
    // Trim and try native parse first (handles YYYY-MM-DD)
    const trimmed = cell.trim();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      return d.toISOString().split('T')[0];  // YYYY-MM-DD
    }
    // Manual parse for MM/DD/YYYY or DD-MM-YYYY
    const parts = trimmed.split(/[-\/]/);
    if (parts.length === 3) {
      const nums = parts.map(p => parseInt(p, 10));
      if (!isNaN(nums[0]) && !isNaN(nums[1]) && !isNaN(nums[2])) {
        // Guess format: if first part > 12, assume YYYY; else MM/DD/YYYY
        if (nums[0] > 31) {  // Likely YYYY
          return `${nums[0]}-${String(nums[1]).padStart(2, '0')}-${String(nums[2]).padStart(2, '0')}`;
        } else {
          return `${nums[2]}-${String(nums[0]).padStart(2, '0')}-${String(nums[1]).padStart(2, '0')}`;
        }
      }
    }
  } else if (typeof cell === 'number' && cell > 25569) {  // Excel serial date (post-1900)
    const utc_days = Math.floor(cell - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return `${date_info.getUTCFullYear()}-${String(date_info.getUTCMonth() + 1).padStart(2, '0')}-${String(date_info.getUTCDate()).padStart(2, '0')}`;
  }

  return null;  // Invalid
}

eventsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const created = [];
    const skipped = [];
    for (const row of rows) {
      const event_type = row['Event Type'] || null;
      const event_name = row['Event Name'] || null;
      const event_date_raw = row['Event Date'];
      const event_date = parseExcelDate(event_date_raw);

      // Skip if required fields missing/invalid
      if (!event_type || !event_name || !event_date) {
        skipped.push({
          type: event_type,
          name: event_name,
          date: event_date_raw,
          reason: !event_date ? 'Invalid date' : 'Missing type/name'
        });
        console.warn(`Skipping invalid row: ${event_type} - ${event_name} (${event_date_raw})`);
        continue;
      }

      // Check for duplicate before create
      const existing = await Event.findOne({
        where: {
          event_type,
          event_name
        }
      });
      if (existing) {
        console.warn(`Skipping duplicate: ${event_type} - ${event_name}`);
        continue;
      }

      const record = await Event.create({
        event_type,
        event_name,
        event_date  // Now guaranteed YYYY-MM-DD or skipped
      });
      created.push(record);
    }
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped;  // Optional: for debugging
    }
    res.json(response);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        error: 'Duplicate event found', 
        details: 'One or more records violate unique constraints on type/name' 
      });
    }
    next(e);
  }
});