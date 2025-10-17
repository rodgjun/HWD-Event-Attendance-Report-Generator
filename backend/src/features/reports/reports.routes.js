import { Router } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { Attendance, Event, Registration, Dmag } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';

export const reportsRouter = Router();

reportsRouter.get('/event-summary/:eventId', requireAuth, async (req, res, next) => {
  try {
    const eventId = Number(req.params.eventId);
    const total = await Attendance.count({ where: { event_id: eventId } });
    const virtual = await Attendance.count({ where: { event_id: eventId, mode_of_attendance: 'Virtual' } });
    const onsite = await Attendance.count({ where: { event_id: eventId, mode_of_attendance: 'Onsite' } });
    const registered = await Attendance.count({ where: { event_id: eventId, validation_status: 'Registered' } });
    const walkIns = await Attendance.count({ where: { event_id: eventId, validation_status: 'Not Registered' } });
    res.json({ total, virtual, onsite, registered, walkIns });
  } catch (e) {
    next(e);
  }
});

reportsRouter.get('/overall', requireAuth, async (_req, res, next) => {
  try {
    const topEmployees = await Attendance.findAll({
      attributes: ['employee_no', 'employee_name', [fn('COUNT', col('attendance_id')), 'count']],
      group: ['employee_no', 'employee_name'],
      order: [[literal('count'), 'DESC']],
      limit: 10,
    });

    const topDepartments = await Attendance.findAll({
      attributes: ['department', [fn('COUNT', col('attendance_id')), 'count']],
      group: ['department'],
      order: [[literal('count'), 'DESC']],
      limit: 10,
    });

    const genderBreakdown = await Attendance.findAll({
      attributes: ['department'], // placeholder to keep query valid
      limit: 0,
    });
    // Gender requires a join with DMAG; keeping minimal due to sqlite demo.

    res.json({ topEmployees, topDepartments });
  } catch (e) {
    next(e);
  }
});


