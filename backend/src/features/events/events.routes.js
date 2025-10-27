import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js';
import { Event } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';

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
      date,
      search  // New: unified search param
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const where = {};
    
    // Handle separate filters
    if (type) where.event_type = { [Op.like]: `%${type}%` };
    if (name) where.event_name = { [Op.like]: `%${name}%` };
    if (date) where.event_date = { [Op.eq]: date };
    
    // Handle unified search: OR across name and type (case-insensitive)
    if (search) {
      where[Op.or] = [
        { event_name: { [Op.iLike]: `%${search}%` } },
        { event_type: { [Op.iLike]: `%${search}%` } }
      ];
      console.log(`Search query: "${search}" (filtered ${res.locals.eventCount || 'N/A'} events)`); // Optional logging
    }
    
    const { count, rows } = await Event.findAndCountAll({
      where,
      order: [[sort, order.toUpperCase()]],
      limit: Number(limit),
      offset
    });
    
    res.json({
      events: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    console.error('GET /events error:', e);
    next(e);
  }
});

// New non-paginated route for dropdown/full list
eventsRouter.get('/all', requireAuth, async (req, res, next) => {
  try {
    const events = await Event.findAll({
      order: [['event_name', 'ASC']] // Alphabetical for UX
    });
    res.json({ events });
  } catch (e) {
    console.error('GET /events/all error:', e);
    next(e);
  }
});


// Deprecated: Use GET /?search= instead (remove in v2)
eventsRouter.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { type, name } = req.query;
    const where = {};
    if (type) where.event_type = { [Op.like]: `%${type}%` };
    if (name) where.event_name = { [Op.like]: `%${name}%` };
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
    body('event_type').isString().notEmpty().trim(),
    body('event_name').isString().notEmpty().trim(),
    body('event_date').isDate({ format: 'YYYY-MM-DD' }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      // Check for duplicate event
      const existingEvent = await Event.findOne({
        where: {
          event_type: req.body.event_type.trim(),
          event_name: req.body.event_name.trim()
        }
      });
      
      if (existingEvent) {
        return res.status(409).json({ 
          error: 'Duplicate event found', 
          details: `Event "${req.body.event_name.trim()}" of type "${req.body.event_type.trim()}" already exists` 
        });
      }
      
      const created = await Event.create({
        event_type: req.body.event_type.trim(),
        event_name: req.body.event_name.trim(),
        event_date: req.body.event_date
      });
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
    body('event_type').optional().isString().trim(),
    body('event_name').optional().isString().trim(),
    body('event_date').optional().isDate({ format: 'YYYY-MM-DD' }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const event = await Event.findByPk(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      const updateData = {
        event_type: req.body.event_type ? req.body.event_type.trim() : event.event_type,
        event_name: req.body.event_name ? req.body.event_name.trim() : event.event_name,
        ...(req.body.event_date && { event_date: req.body.event_date })
      };
      
      // Check for duplicate (excluding current)
      const existingEvent = await Event.findOne({
        where: {
          event_type: updateData.event_type,
          event_name: updateData.event_name,
          event_id: { [Op.ne]: req.params.id }
        }
      });
      
      if (existingEvent) {
        return res.status(409).json({ 
          error: 'Duplicate event found', 
          details: `Event "${updateData.event_name}" of type "${updateData.event_type}" already exists` 
        });
      }
      
      await event.update(updateData);
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
  if (!cell || cell === '') return null;  // Explicit null for invalid/empty

  if (typeof cell === 'string') {
    const trimmed = cell.trim();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
      return d.toISOString().split('T')[0];  // YYYY-MM-DD
    }
    // Manual parse for MM/DD/YYYY or DD-MM-YYYY
    const parts = trimmed.split(/[-\/]/);
    if (parts.length === 3) {
      const nums = parts.map(p => parseInt(p.trim(), 10));
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
      const event_type = (row['Event Type'] || '').trim();
      const event_name = (row['Event Name'] || '').trim();
      const event_date_raw = row['Event Date'];
      const event_date = parseExcelDate(event_date_raw);

      // Skip if required fields missing/invalid
      let reason = '';
      if (!event_type) reason = 'Missing event type';
      else if (!event_name) reason = 'Missing event name';
      else if (!event_date) reason = 'Invalid event date';
      if (reason) {
        skipped.push({
          event_type,
          event_name,
          reason,  // Descriptive reason
          date_raw: event_date_raw  // For debugging
        });
        console.warn(`Skipping invalid row: ${reason} - ${event_type} - ${event_name} (${event_date_raw})`);
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
        skipped.push({
          event_type,
          event_name,
          reason: `Duplicate event "${event_name}" of type "${event_type}"`
        });
        console.warn(`Skipping duplicate: ${event_type} - ${event_name}`);
        continue;
      }

      const record = await Event.create({
        event_type,
        event_name,
        event_date
      });
      created.push(record);
    }
    const response = { inserted: created.length };
    if (skipped.length > 0) {
      response.skipped = skipped.length;
      response.skip_details = skipped;  // Includes event_name, event_type, reason for frontend display
    }
    res.json(response);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ 
        error: 'Duplicate event found', 
        details: 'One or more records violate unique constraints on type/name' 
      });
    }
    console.error('POST /events/upload error:', e);
    next(e);
  }
});

// GET /events/export - Export filtered events as Excel
eventsRouter.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { search, format = 'xlsx' } = req.query;
    const where = search ? { event_name: { [Op.iLike]: `%${search}%` } } : {};
    
    const events = await Event.findAll({ where });
    
    const headers = ['Event ID', 'Event Type', 'Event Name', 'Event Date'];
    const rows = events.map(e => [
      e.event_id, e.event_type, e.event_name, e.event_date
    ]);
    
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Events');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: format });
    res.setHeader('Content-Type', `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`);
    res.setHeader('Content-Disposition', `attachment; filename=events-${new Date().toISOString().split('T')[0]}.${format}`);
    res.send(buffer);
  } catch (e) {
    console.error('GET /events/export error:', e);
    next(e);
  }
});

// GET /events/template - Download Excel template
eventsRouter.get('/template', requireAuth, async (req, res, next) => {
  try {
    // Sample data
    const templateData = [
      ['Event Type', 'Event Name', 'Event Date'], // Headers
      ['Seminar', 'Wellness Workshop', '2025-11-01'], // Sample row
      ['Club 120', 'Fitness Session', '2025-11-15']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Events Template');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=events-template.xlsx');
    res.send(buffer);
  } catch (e) {
    console.error('GET /events/template error:', e);
    next(e);
  }
});