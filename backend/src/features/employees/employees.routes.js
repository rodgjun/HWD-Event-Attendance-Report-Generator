import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Dmag } from '../../core/models.js';
import { requireAuth } from '../_shared/auth-middleware.js';

export const employeesRouter = Router();

employeesRouter.get('/by-number/:employee_no', requireAuth, async (req, res, next) => {
  try {
    const employee = await Dmag.findOne({ where: { employee_no: req.params.employee_no } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee_no: employee.employee_no, employee_name: employee.employee_name, department: employee.department });
  } catch (e) {
    next(e);
  }
});

employeesRouter.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const { getUniqueDepartments } = await import('../../core/models.js');
    const departments = await getUniqueDepartments();
    res.json(departments.map(d => d.department));
  } catch (e) {
    next(e);
  }
});

employeesRouter.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const departments = await sequelize.query(
      `SELECT DISTINCT department as department FROM dmags WHERE department IS NOT NULL ORDER BY department`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.json(departments.map(d => d.department).filter(Boolean));
  } catch (e) {
    console.error('GET /employees/departments error:', e);
    next(e);
  }
});