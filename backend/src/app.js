import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { sequelize } from './core/db.js';
import { registerModels, syncDb, Admin } from './core/models.js';
import { errorMiddleware } from './core/error-middleware.js';
import { authRouter } from './features/auth/auth.routes.js';
import { eventsRouter } from './features/events/events.routes.js';
import { registrationsRouter } from './features/registrations/registrations.routes.js';
import { attendanceRouter } from './features/attendance/attendance.routes.js';
import { reportsRouter } from './features/reports/reports.routes.js';
import { cleanupDuplicates } from './migrations/cleanup-duplicates.js';
import { employeesRouter } from './features/employees/employees.routes.js';


const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

registerModels();
await syncDb();

// Clean up duplicates and add unique constraints
try {
  await cleanupDuplicates();
} catch (error) {
  console.error('Warning: Could not clean up duplicates:', error.message);
  console.log('Continuing without unique constraints...');
}

// Seed default admin if none exists
const adminCount = await Admin.count();
if (adminCount === 0) {
  const { default: bcrypt } = await import('bcryptjs');
  const password_hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
  await Admin.create({ username: process.env.DEFAULT_ADMIN_USERNAME || 'admin', password_hash });
}

app.get('/api', (_req, res) => {
  res.json({ ok: true, name: 'HWD API', routes: ['/api/health', '/api/auth/login', '/api/events', '/api/registrations', '/api/attendance', '/api/reports'] });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/employees', employeesRouter);

app.use(errorMiddleware);

const port = process.env.PORT || 4000;
const server = createServer(app);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`HWD backend listening on :${port}`);
});


