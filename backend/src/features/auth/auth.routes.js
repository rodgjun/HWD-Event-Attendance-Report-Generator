import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { Admin } from '../../core/models.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  [body('username').isString().notEmpty(), body('password').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { username, password } = req.body;
      const admin = await Admin.findOne({ where: { username } });
      if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, admin.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ sub: admin.admin_id, username }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
      res.json({ token });
    } catch (e) {
      next(e);
    }
  }
);


