// src/features/reports/reports.routes.js

import { Router } from 'express';
import { Op } from 'sequelize';
import { requireAuth } from '../_shared/auth-middleware.js';
import { Event, Attendance, Dmag, Evaluation } from '../../core/models.js'; // Assuming Evaluation is defined in models.js
import { sequelize } from '../../core/db.js'; // Import sequelize for literals and dialect awareness

export const reportsRouter = Router();

// Helper to build dynamic WHERE clauses separately for Event and Attendance
function buildWhereClauses(filters) {
  const eventWhere = {};
  const attendanceWhere = {};

  // Date range on Event
  if (filters.date_from || filters.date_to) {
    eventWhere.event_date = {};
    if (filters.date_from) eventWhere.event_date[Op.gte] = filters.date_from;
    if (filters.date_to) eventWhere.event_date[Op.lte] = filters.date_to;
  }

  // Event type on Event
  if (filters.event_type) {
    eventWhere.event_type = { [Op.iLike]: `%${filters.event_type}%` };
  }

  // Department on Attendance
  if (filters.department) {
    attendanceWhere.department = { [Op.iLike]: `%${filters.department}%` };
  }

  return { eventWhere, attendanceWhere };
}

// Build WHERE conditions as strings for raw queries (named params for Sequelize)
function buildEventWhereSQL(eventWhere) {
  let sql = '1=1';
  const replacements = {};
  if (eventWhere.event_date && eventWhere.event_date[Op.gte]) {
    sql += ` AND "events"."event_date" >= :date_from`;
    replacements.date_from = eventWhere.event_date[Op.gte];
  }
  if (eventWhere.event_date && eventWhere.event_date[Op.lte]) {
    sql += ` AND "events"."event_date" <= :date_to`;
    replacements.date_to = eventWhere.event_date[Op.lte];
  }
  if (eventWhere.event_type) {
    sql += ` AND "events"."event_type" ILIKE :event_type`;
    replacements.event_type = eventWhere.event_type[Op.iLike];
  }
  return { sql, replacements };
}

function buildAttendanceWhereSQL(attendanceWhere) {
  let sql = '1=1';
  const replacements = {};
  if (attendanceWhere.department) {
    sql += ` AND "attendances"."department" ILIKE :department`;
    replacements.department = attendanceWhere.department[Op.iLike];
  }
  return { sql, replacements };
}

// GET /reports/filters - Fetch filter options
reportsRouter.get('/filters', requireAuth, async (req, res, next) => {
  try {
    const [eventTypes, departments] = await Promise.all([
      Event.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('event_type')), 'event_type']],
        where: { event_type: { [Op.ne]: null } },
        raw: true,
      }),
      Dmag.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('department')), 'department']],
        where: { department: { [Op.ne]: null } },
        raw: true,
      }),
    ]);

    res.json({
      event_types: eventTypes.map(t => t.event_type).sort().filter(Boolean),
      departments: departments.map(d => d.department).sort().filter(Boolean),
    });
  } catch (e) {
    console.error('GET /reports/filters error:', e);
    next({ status: 500, message: 'Failed to fetch filters', details: e.message });
  }
});

// GET /reports/overall - Attendance overview data
reportsRouter.get('/overall', requireAuth, async (req, res, next) => {
  try {
    const { date_from, date_to, event_type, department } = req.query;
    const filters = { date_from, date_to, event_type, department };
    const { eventWhere, attendanceWhere } = buildWhereClauses(filters);

    const { sql: eventSQL, replacements: eventReps } = buildEventWhereSQL(eventWhere);
    const { sql: attSQL, replacements: attReps } = buildAttendanceWhereSQL(attendanceWhere);
    const baseReplacements = { ...eventReps, ...attReps };

    // Monthly Progress: Raw query
    const monthlyReplacements = { ...baseReplacements };
    const monthlyProgress = await sequelize.query(
      `
      SELECT 
        to_char("events"."event_date", 'YYYY-MM') AS "month",
        COUNT("attendances"."attendance_id") AS "attendees"
      FROM "attendances"
      INNER JOIN "events" ON "attendances"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY to_char("events"."event_date", 'YYYY-MM')
      ORDER BY to_char("events"."event_date", 'YYYY-MM') ASC
      `,
      {
        replacements: monthlyReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Top 5 Events by attendees: Raw query
    const topEventsReplacements = { ...baseReplacements };
    const topEvents = await sequelize.query(
      `
      SELECT 
        "events"."event_name" AS "event_name",
        COUNT("attendances"."attendance_id") AS "attendees"
      FROM "attendances"
      INNER JOIN "events" ON "attendances"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY "events"."event_id", "events"."event_name"
      ORDER BY COUNT("attendances"."attendance_id") DESC
      LIMIT 5
      `,
      {
        replacements: topEventsReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Top 5 Employees: Raw query
    const topEmployeesReplacements = { ...baseReplacements };
    const topEmployees = await sequelize.query(
      `
      SELECT 
        COALESCE("attendances"."employee_no", "attendances"."employee_name") AS "identifier",
        COUNT("attendances"."attendance_id") AS "attendance_count"
      FROM "attendances"
      INNER JOIN "events" ON "attendances"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY COALESCE("attendances"."employee_no", "attendances"."employee_name")
      ORDER BY COUNT("attendances"."attendance_id") DESC
      LIMIT 5
      `,
      {
        replacements: topEmployeesReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Top 5 Departments: Raw query
    const topDepartmentsReplacements = { ...baseReplacements };
    const topDepartments = await sequelize.query(
      `
      SELECT 
        "attendances"."department" AS "department",
        COUNT("attendances"."attendance_id") AS "attendees"
      FROM "attendances"
      INNER JOIN "events" ON "attendances"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY "attendances"."department"
      ORDER BY COUNT("attendances"."attendance_id") DESC
      LIMIT 5
      `,
      {
        replacements: topDepartmentsReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Demographics: Raw query
    const demoReplacements = { ...baseReplacements };
    const demographics = await sequelize.query(
      `
      SELECT 
        CASE 
          WHEN "dmags"."age" IS NULL THEN 'Unknown'
          WHEN "dmags"."age" < 30 THEN '<30' 
          WHEN "dmags"."age" BETWEEN 30 AND 40 THEN '30-40' 
          WHEN "dmags"."age" BETWEEN 41 AND 50 THEN '41-50' 
          ELSE '>50' END AS "age_range",
        "dmags"."gender" AS "gender",
        COUNT("attendances"."attendance_id") AS "count"
      FROM "attendances"
      INNER JOIN "events" ON "attendances"."event_id" = "events"."event_id"
      LEFT JOIN "dmags" ON "attendances"."employee_no" = "dmags"."employee_no"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY 
        CASE 
          WHEN "dmags"."age" IS NULL THEN 'Unknown'
          WHEN "dmags"."age" < 30 THEN '<30' 
          WHEN "dmags"."age" BETWEEN 30 AND 40 THEN '30-40' 
          WHEN "dmags"."age" BETWEEN 41 AND 50 THEN '41-50' 
          ELSE '>50' END,
        "dmags"."gender"
      `,
      {
        replacements: demoReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Aggregate ageRanges and genders
    const ageRanges = {};
    const genders = {};
    demographics.forEach(row => {
      const ageKey = row.age_range || 'Unknown';
      const genderKey = row.gender || 'Unknown';
      if (!ageRanges[ageKey]) ageRanges[ageKey] = 0;
      ageRanges[ageKey] += parseInt(row.count) || 0;
      if (!genders[genderKey]) genders[genderKey] = 0;
      genders[genderKey] += parseInt(row.count) || 0;
    });

    res.json({
      monthly_progress: monthlyProgress,
      top_events: topEvents,
      top_employees: topEmployees,
      top_departments: topDepartments,
      demographics: { 
        age_ranges: Object.entries(ageRanges).sort(([a], [b]) => a.localeCompare(b)),
        genders: Object.entries(genders).sort(([a], [b]) => a.localeCompare(b))
      },
    });
  } catch (e) {
    console.error('GET /reports/overall error:', e);
    next({ status: 500, message: 'Failed to fetch overall report', details: e.message });
  }
});

// GET /reports/evaluations - Evaluations overview data
// GET /reports/evaluations - Evaluations overview data (updated casts)
reportsRouter.get('/evaluations', requireAuth, async (req, res, next) => {
  try {
    const { date_from, date_to, event_type, department } = req.query;
    const filters = { date_from, date_to, event_type, department };
    const { eventWhere, attendanceWhere } = buildWhereClauses(filters); // Reuse for consistency

    const { sql: eventSQL, replacements: eventReps } = buildEventWhereSQL(eventWhere);
    const { sql: attSQL, replacements: attReps } = buildAttendanceWhereSQL(attendanceWhere);
    const baseReplacements = { ...eventReps, ...attReps };

    // Top 3 Events by Overall Conduct Avg: Raw query
    const topConductReplacements = { ...baseReplacements };
    const topConductEvents = await sequelize.query(
      `
      SELECT 
        "events"."event_name" AS "event_name",
        AVG("evaluations"."overall_rating"::text::numeric) AS "avg_rating",
        COUNT("evaluations"."evaluation_id") AS "feedback_count"
      FROM "evaluations"
      INNER JOIN "events" ON "evaluations"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY "events"."event_id", "events"."event_name"
      ORDER BY AVG("evaluations"."overall_rating"::text::numeric) DESC
      LIMIT 3
      `,
      {
        replacements: topConductReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Top 3 Events by Resource Speaker Avg: Raw query
    const topSpeakerReplacements = { ...baseReplacements };
    const topSpeakerEvents = await sequelize.query(
      `
      SELECT 
        "events"."event_name" AS "event_name",
        AVG("evaluations"."presentation_materials"::text::numeric) AS "avg_rating",
        COUNT("evaluations"."evaluation_id") AS "feedback_count"
      FROM "evaluations"
      INNER JOIN "events" ON "evaluations"."event_id" = "events"."event_id"
      WHERE ${eventSQL} AND ${attSQL}
      GROUP BY "events"."event_id", "events"."event_name"
      ORDER BY AVG("evaluations"."presentation_materials"::text::numeric) DESC
      LIMIT 3
      `,
      {
        replacements: topSpeakerReplacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.json({
      top_conduct_events: topConductEvents,
      top_speaker_events: topSpeakerEvents,
    });
  } catch (e) {
    console.error('GET /reports/evaluations error:', e);
    next({ status: 500, message: 'Failed to fetch evaluations report', details: e.message });
  }
});

export default reportsRouter;