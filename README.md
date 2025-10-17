# HWD Event Attendance & Reports System

This repository contains a clean, modular full‑stack app for BSP HWD to manage events, registrations, attendance (manual and bulk via CSV/XLSX), and analytics with advanced filtering, pagination, and data integrity features.

## Tech Stack
- Backend: Node.js, Express, Sequelize, Multer, XLSX, JWT
- DB: SQLite by default (switchable to Postgres/MySQL)
- Frontend: React, Vite, TailwindCSS, React Router, Axios

## Monorepo Layout
- `backend/` REST API
- `frontend/` React SPA

## Quick Start (Local)
1) Prerequisites
- Node.js 18+
- npm or yarn or pnpm

2) Backend
```bash
cd backend
npm i
# Create .env with at least these values:
# PORT=4000
# JWT_SECRET=change_me
# DB_DIALECT=sqlite
# DB_STORAGE=hwd.sqlite
# DEFAULT_ADMIN_USERNAME=admin
# DEFAULT_ADMIN_PASSWORD=admin123

# If you have existing data with duplicates, run migration first:
npm run migrate

npm run dev
```
API runs at `http://localhost:4000/api`.

**Note**: If you encounter duplicate key errors when starting the server, the migration will automatically clean up duplicate data and add unique constraints. You can also run `npm run migrate` manually before starting the server.

3) Frontend
```bash
cd ../frontend
npm i
# optionally set VITE_API_BASE_URL in .env (defaults to http://localhost:4000/api)
npm run dev
```
SPA runs at the printed Vite URL (usually `http://localhost:5173`).

4) Login
- Navigate to `/login` (simple form). Default credentials:
  - username: `admin`
  - password: `admin123`
- Token is kept in localStorage; protected API calls include it automatically.

## Clean Architecture Overview
- Core: `backend/src/core` → DB, models, error middleware
- Features: `backend/src/features/*` → vertical slices (auth, events, registrations, attendance, reports)
- Shared: `backend/src/features/_shared` → auth middleware
- Frontend mirrors features as pages and uses `src/services/api.ts` for HTTP.

## 🆕 New Features (v2.0)

### Enhanced Data Management
- **Removed Status Field**: Registration table no longer includes status field for cleaner data model
- **Event Names Display**: Registrations and Attendance tables now show actual event names instead of IDs
- **Unique Constraints**: Database enforces unique event names per event type and prevents duplicate registrations/attendance

### Advanced Filtering & Search
- **Events**: Filter by Event Type, Event Name, or Date
- **Registrations**: Filter by Employee No, Employee Name, Department, Event Name, or Event ID
- **Attendance**: Filter by Employee No, Employee Name, Department, Event Name, or Event ID
- **Real-time Search**: All filters update results instantly as you type

### Server-Side Pagination & Sorting
- **Pagination**: All tables support server-side pagination (10 records per page by default)
- **Sorting**: Click column headers to sort by any field (ascending/descending)
- **Performance**: Large datasets load efficiently with pagination controls

### Data Integrity & Error Handling
- **Duplicate Prevention**: System prevents duplicate registrations and attendance records
- **Comprehensive Error Handling**: User-friendly error messages with detailed information
- **Validation**: Enhanced input validation with clear feedback
- **Database Constraints**: Unique indexes prevent data inconsistencies

### Responsive UI Improvements
- **Modern Design**: Clean, responsive interface with Tailwind CSS
- **Interactive Elements**: Hover effects, loading states, and visual feedback
- **Mobile-Friendly**: Tables scroll horizontally on smaller screens
- **Accessibility**: Proper labels, keyboard navigation, and screen reader support

## CSV/XLSX Templates
- Events.csv: `Event Type | Event Name | Event Date`
- Registration.csv: `Employee No | Employee Name | Department | Event ID`
- Attendance.csv: `Employee No | Employee Name | Department | Mode of Attendance | Event ID`

## Key API Endpoints

### Authentication
- `POST /api/auth/login` → { token }

### Events (with pagination & filtering)
- `GET /api/events?page=1&limit=10&sort=event_date&order=DESC&type=workshop&name=training&date=2024-01-01`
- `POST /api/events` (with duplicate checking)
- `PUT /api/events/:id` (with duplicate checking)
- `DELETE /api/events/:id`
- `POST /api/events/upload`

### Registrations (with pagination & filtering)
- `GET /api/registrations?page=1&limit=10&sort=employee_name&order=ASC&employee_no=123&department=IT&event_name=workshop`
- `POST /api/registrations` (with duplicate checking)
- `PUT /api/registrations/:id` (with duplicate checking)
- `DELETE /api/registrations/:id`
- `POST /api/registrations/upload`

### Attendance (with pagination & filtering)
- `GET /api/attendance?page=1&limit=10&sort=attendance_id&order=DESC&employee_name=john&event_name=training`
- `POST /api/attendance` (with duplicate checking)
- `PUT /api/attendance/:id` (with duplicate checking)
- `DELETE /api/attendance/:id`
- `POST /api/attendance/upload`

### Reports
- `GET /api/reports/event-summary/:eventId`
- `GET /api/reports/overall`

All except login require a Bearer token.

## Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 10)

### Sorting
- `sort`: Field to sort by (e.g., `event_date`, `employee_name`, `department`)
- `order`: Sort direction (`ASC` or `DESC`)

### Filtering
- **Events**: `type`, `name`, `date`
- **Registrations**: `event_id`, `employee_no`, `employee_name`, `department`, `event_name`
- **Attendance**: `event_id`, `employee_no`, `employee_name`, `department`, `event_name`

## Switching Databases
Set `.env` in `backend/` for MySQL (XAMPP):
- `DB_DIALECT=mysql`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=hwd_db`
- `DB_USER=root`
- `DB_PASSWORD=` (empty by default on XAMPP; set if you configured one)

Steps (XAMPP):
1. Start Apache and MySQL in XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`, create database `hwd_db` with utf8mb4.
3. Ensure `.env` matches the values above.
4. Run `npm run dev` in `backend/` — Sequelize will auto-create tables with unique constraints.

## Production Notes
- Use Postgres/MySQL and a strong `JWT_SECRET`.
- Prefer migrations to `sync()` for schema changes.
- Serve frontend statics via CDN; set `VITE_API_BASE_URL` to the API URL.
- Configure CORS to only allow trusted origins.
- Database constraints will prevent duplicate data in production.

## Error Handling & Validation
- Central `errorMiddleware` returns JSON `{ error, details }` with proper status codes.
- Inputs validated via `express-validator` on each route.
- Duplicate detection with user-friendly error messages.
- Comprehensive try-catch blocks throughout the application.

## Security
- JWT-based auth, bcrypt password hashing
- Input validation and sanitization
- SQL injection protection via Sequelize ORM
- CORS configuration for API security

## Scripts
- Backend: `npm run dev` (nodemon), `npm start`
- Frontend: `npm run dev`, `npm run build`, `npm run preview`

## License
For internal HWD use.

