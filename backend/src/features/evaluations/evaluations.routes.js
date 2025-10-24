import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { body, validationResult } from 'express-validator';
import { sequelize } from '../../core/db.js';
import { Evaluation, Event } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Op } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });
export const evaluationsRouter = Router();

// GET /evaluations - Paginated list with search and filters
evaluationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'evaluation_id', 
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

// POST /evaluations - Create new evaluation
evaluationsRouter.post(
  '/',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').isString().notEmpty().trim(),
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
      
      // Duplicate check: employee_no + event_id OR employee_name + event_id
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

// PUT /evaluations/:id - Update evaluation
evaluationsRouter.put(
  '/:id',
  requireAuth,
  [
    body('employee_no').optional().trim(),
    body('employee_name').optional().isString().trim(),
    body('event_id').optional().isInt({ min: 1 }),
    // ... (same validation for ratings as POST)
  ],
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

// DELETE /evaluations/:id
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

// POST /evaluations/upload - Excel upload with parsing and skipping
evaluationsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { buffer } = req.file || {};
    if (!buffer) return res.status(400).json({ error: 'No file uploaded' });
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    const created = [];
    const skipped = [];
    const seen = new Map(); // Track duplicates: employee_no_event_id or name_event_id
    
    for (const row of rows) {
      const employee_no = (row['Employee No'] || '').trim();
      const employee_name = (row['Employee Name'] || '').trim();
      const event_name = (row['Event Name'] || '').trim();
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
      
      // Parse ratings (map column names to fields, validate ENUMs)
      const ratings = {};
      const ratingFields = {
        'Employee No': 'employee_no',
        'Employee Name': 'employee_name',
        'Event Name': 'event_name', // Temp for lookup; resolve to event_id
        'Objectives Met': 'objectives_met',
        'Relevance': 'relevance',
        'Venue': 'venue',
        'Activity': 'activity',
        'Value of Time Spent': 'value_time_spent',
        'Overall Rating': 'overall_rating',
        'Discussed Topic Clearly and Effectively': 'topic_clear_effective',
        'Answered Questions Appropriately': 'answered_questions',
        'Presentation/Materials': 'presentation_materials',
        'Session Helpful': 'session_helpful' // 'Yes'/'No'
        };
      for (const [col, field] of Object.entries(ratingFields)) {
        const val = (row[col] || 'NA').toString().trim().toUpperCase();
        if (['1','2','3','4','5','NA'].includes(val) || (field === 'session_helpful' && ['YES','NO'].includes(val.toUpperCase()))) {
          ratings[field] = val === 'YES' ? 'Yes' : val;
        } else {
          skipped.push({ employee_name, event_name, reason: `Invalid ${field} value: ${val}` });
          break;
        }
      }
      
      // Duplicate key
      const key = finalEmployeeNo 
        ? `${finalEmployeeNo}_${event.event_id}` 
        : `${employee_name.toLowerCase()}_${event.event_id}`;
      
      if (seen.has(key)) {
        skipped.push({ employee_name, event_name, reason: 'Duplicate evaluation' });
        continue;
      }
      seen.set(key, true);
      
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


// GET /evaluations/template
// GET /evaluations/template (CSV version)
evaluationsRouter.get('/template', requireAuth, async (req, res, next) => {
  try {
    const headers = [
      'Employee No', 'Employee Name', 'Event Name', 'Objectives Met', 'Relevance', 'Venue',
      'Activity', 'Value of Time Spent', 'Overall Rating', 'Discussed Topic Clearly and Effectively',
      'Answered Questions Appropriately', 'Presentation/Materials', 'Session Helpful'
    ];
    const sampleRow = ['', '', '', '5', '4', '5', '4', '5', '5', '5', '4', '5', 'Yes'];

    const csvData = [headers, sampleRow]
      .map(row => row.map(value => `"${value}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluation-template.csv"');
    res.send(csvData);
  } catch (e) {
    console.error('GET /evaluations/template (CSV) error:', e);
    next(e);
  }
});