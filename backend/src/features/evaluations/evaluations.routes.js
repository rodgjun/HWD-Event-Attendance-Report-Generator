import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js'; // Import Op if not already
import { Evaluation, Event } from '../../core/models.js'; // Assume Evaluation defined in models.js
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';

const upload = multer({ storage: multer.memoryStorage() });
export const evaluationsRouter = Router();

// GET /evaluations - Paginated list with event filter, search, sorting (match Attendance)
evaluationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'evaluation_id', 
      order = 'DESC', 
      event_id,
      search 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
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
      attributes: ['event_id', 'event_name']
    }];
    
    const { count, rows } = await Evaluation.findAndCountAll({
      where,
      include,
      order: [[sort, order.toUpperCase()]],
      limit: Number(limit),
      offset
    });
    
    res.json({
      evaluations: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (e) {
    console.error('GET /evaluations error:', e);
    next(e);
  }
});

// POST /evaluations/bulk-delete - Bulk delete by IDs
evaluationsRouter.post('/bulk-delete', requireAuth, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid IDs array' });
    }
    if (ids.length > 1000) { // Arbitrary limit for safety
      return res.status(400).json({ error: 'Too many IDs (max 1000)' });
    }
    
    const deletedCount = await Evaluation.destroy({
      where: { evaluation_id: ids }
    });
    
    res.json({ deleted: deletedCount, message: `${deletedCount} evaluations deleted` });
  } catch (e) {
    console.error('POST /evaluations/bulk-delete error:', e);
    next(e);
  }
});

// GET /evaluations/export - Export filtered data as Excel
evaluationsRouter.get('/export', requireAuth, async (req, res, next) => {
  try {
    const { event_id, format = 'xlsx' } = req.query;
    const where = event_id ? { event_id: Number(event_id) } : {};
    
    const evaluations = await Evaluation.findAll({
      where,
      include: [{ model: Event, attributes: ['event_name'] }]
    });
    
    // Map to export data (headers + rows)
    const headers = [
      'Employee No', 'Employee Name', 'Event Name', 'Objectives Met', 'Relevance', 'Venue',
      'Activity', 'Value of Time Spent', 'Overall Rating', 'Topic Clear Effective',
      'Answered Questions', 'Presentation Materials', 'Session Helpful'
    ];
    const rows = evaluations.map(e => [
      e.employee_no || '', e.employee_name, e.event.event_name,
      e.objectives_met || 'NA', e.relevance || 'NA', e.venue || 'NA',
      e.activity || 'NA', e.value_time_spent || 'NA', e.overall_rating || 'NA',
      e.topic_clear_effective || 'NA', e.answered_questions || 'NA',
      e.presentation_materials || 'NA', e.session_helpful || 'NA'
    ]);
    
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluations');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: format });
    res.setHeader('Content-Type', `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`);
    res.setHeader('Content-Disposition', `attachment; filename=evaluations-${new Date().toISOString().split('T')[0]}.${format}`);
    res.send(buffer);
  } catch (e) {
    console.error('GET /evaluations/export error:', e);
    next(e);
  }
});

// POST /evaluations - Create (retained, with minor validation tweaks)
evaluationsRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').notEmpty().trim().escape(),
    body('event_id').isInt({ min: 1 }),
    body('objectives_met').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('relevance').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('venue').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('activity').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('value_time_spent').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('overall_rating').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('topic_clear_effective').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('answered_questions').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('presentation_materials').optional().isIn(['1', '2', '3', '4', '5', 'NA']),
    body('session_helpful').optional().isIn(['Yes', 'No'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { event_id, employee_no, employee_name, ...ratings } = req.body;
      const finalEmployeeNo = employee_no?.trim() || null;
      
      // Duplicate check
      const existing = await Evaluation.findOne({
        where: {
          event_id: Number(event_id),
          [Op.or]: [
            finalEmployeeNo ? { employee_no: finalEmployeeNo } : null,
            { employee_name: employee_name.trim() }
          ].filter(Boolean)
        }
      });
      
      if (existing) {
        return res.status(409).json({ 
          error: 'Duplicate evaluation found',
          details: `Evaluation for "${employee_name.trim()}" in event ${event_id} already exists`
        });
      }
      
      const created = await Evaluation.create({
        employee_no: finalEmployeeNo,
        employee_name: employee_name.trim(),
        event_id: Number(event_id),
        ...ratings
      });
      
      res.status(201).json(created);
    } catch (e) {
      if (e.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Duplicate evaluation', details: 'Unique constraint violated' });
      }
      next(e);
    }
  }
);

// PUT /evaluations/:id - Update (retained)
evaluationsRouter.put(
  '/:id',
  requireAuth,
  [ /* Same validations as POST, optional for updates */ ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      const evaluation = await Evaluation.findByPk(req.params.id);
      if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });
      
      const { event_id, employee_no, employee_name, ...ratings } = req.body;
      const updateData = {
        ...(employee_name && { employee_name: employee_name.trim() }),
        ...(employee_no && { employee_no: employee_no.trim() }),
        ...(event_id && { event_id: Number(event_id) }),
        ...ratings
      };
      
      // Duplicate check excluding self
      const existing = await Evaluation.findOne({
        where: {
          ...updateData,
          evaluation_id: { [Op.ne]: req.params.id }
        }
      });
      
      if (existing) {
        return res.status(409).json({ error: 'Duplicate evaluation found' });
      }
      
      await evaluation.update(updateData);
      res.json(evaluation);
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /evaluations/:id (retained)
evaluationsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const evaluation = await Evaluation.findByPk(req.params.id);
    if (!evaluation) return res.status(404).json({ error: 'Evaluation not found' });
    await evaluation.destroy();
    res.json({ message: 'Evaluation deleted successfully' });
  } catch (e) {
    next(e);
  }
});

// POST /evaluations/upload - Enhanced for Excel (with skipping)
// POST /evaluations/upload - Enhanced for Excel with DB duplicate check
evaluationsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    const created = [];
    const skipped = [];
    const seen = new Map(); // Track batch duplicates
    
    for (const row of rows) {
      const employee_no = (row['Employee No'] || '').toString().trim();
      const employee_name = (row['Employee Name'] || '').toString().trim();
      const event_name = (row['Event Name'] || '').toString().trim();
      const finalEmployeeNo = employee_no || null;
      
      if (!employee_name || !event_name) {
        skipped.push({ employee_name, event_name, reason: 'Missing name or event' });
        continue;
      }
      
      const event = await Event.findOne({ where: { event_name: { [Op.iLike]: event_name } } });
      if (!event) {
        skipped.push({ employee_name, event_name, reason: `Event "${event_name}" not found` });
        continue;
      }
      
      // Parse ratings (unchanged)
      const ratings = {};
      const ratingFields = {
        'Objectives Met': 'objectives_met',
        'Relevance': 'relevance',
        'Venue': 'venue',
        'Activity': 'activity',
        'Value of Time Spent': 'value_time_spent',
        'Overall Rating': 'overall_rating',
        'Discussed Topic Clearly and Effectively': 'topic_clear_effective',
        'Answered Questions Appropriately': 'answered_questions',
        'Presentation/Materials': 'presentation_materials',
        'Session Helpful': 'session_helpful'
      };
      let validRow = true;
      for (const [col, field] of Object.entries(ratingFields)) {
        const val = (row[col] || 'NA').toString().trim().toUpperCase();
        if (['1','2','3','4','5','NA'].includes(val) || 
            (field === 'session_helpful' && ['YES','NO'].includes(val))) {
          ratings[field] = val === 'YES' ? 'Yes' : (val === 'NO' ? 'No' : val.toLowerCase());
        } else {
          skipped.push({ employee_name, event_name, reason: `Invalid ${field}: ${val}` });
          validRow = false;
          break;
        }
      }
      if (!validRow) continue;
      
      // Batch duplicate key
      const batchKey = finalEmployeeNo 
        ? `${finalEmployeeNo}_${event.event_id}` 
        : `${employee_name.toLowerCase()}_${event.event_id}`;
      
      if (seen.has(batchKey)) {
        skipped.push({ employee_name, event_name, reason: 'Duplicate in upload batch' });
        continue;
      }
      seen.set(batchKey, true);
      
      // NEW: DB duplicate check (exact match on key)
      const dbExisting = await Evaluation.findOne({
        where: {
          event_id: event.event_id,
          [Op.or]: [
            finalEmployeeNo ? { employee_no: finalEmployeeNo } : null,
            { employee_name }
          ].filter(Boolean)
        }
      });
      
      if (dbExisting) {
        skipped.push({ 
          employee_name, 
          event_name, 
          reason: `Duplicate exists in database for "${employee_name}" in event "${event_name}"` 
        });
        continue;
      }
      
      const record = await Evaluation.create({
        employee_no: finalEmployeeNo,
        employee_name,
        event_id: event.event_id,
        ...ratings
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
    console.error('POST /evaluations/upload error:', e);
    next(e);
  }
});

// GET /evaluations/template - Excel template (enhanced from CSV)
evaluationsRouter.get('/template', requireAuth, async (req, res, next) => {
  try {
    const events = await Event.findAll({ attributes: ['event_id', 'event_name'] });
    
    // Main template sheet
    const headers = [
      'Employee No', 'Employee Name', 'Event Name', 'Objectives Met', 'Relevance', 'Venue',
      'Activity', 'Value of Time Spent', 'Overall Rating', 'Discussed Topic Clearly and Effectively',
      'Answered Questions Appropriately', 'Presentation/Materials', 'Session Helpful'
    ];
    const sampleRow = ['', 'Sample Name', 'Sample Event', '5', '4', '5', '4', '5', '5', '5', '4', '5', 'Yes'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    
    // Events reference sheet
    const eventsData = [['Event ID', 'Event Name']];
    events.forEach(event => eventsData.push([event.event_id, event.event_name]));
    const eventsWs = XLSX.utils.aoa_to_sheet(eventsData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluation Template');
    XLSX.utils.book_append_sheet(wb, eventsWs, 'Events Reference');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=evaluation-template.xlsx');
    res.send(buffer);
  } catch (e) {
    console.error('GET /evaluations/template error:', e);
    next(e);
  }
});