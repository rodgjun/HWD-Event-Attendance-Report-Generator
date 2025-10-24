import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';

export const Admin = sequelize.define('admin', {
  admin_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
});

export const Dmag = sequelize.define('dmag', {
  employee_no: { type: DataTypes.STRING, primaryKey: true },
  employee_name: { type: DataTypes.STRING, allowNull: false },
  department: { type: DataTypes.STRING },
  age: { type: DataTypes.INTEGER },
  gender: { type: DataTypes.ENUM('Male', 'Female') },
}, { timestamps: false });

export const Event = sequelize.define('event', {
  event_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  event_type: { type: DataTypes.STRING, allowNull: false },
  event_name: { type: DataTypes.STRING, allowNull: false },
  event_date: { type: DataTypes.DATEONLY, allowNull: false },
}, {
  indexes: [
    {
      unique: true,
      fields: ['event_type', 'event_name']
    }
  ]
});

export const Registration = sequelize.define('registration', {
  reg_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  employee_no: { type: DataTypes.STRING, allowNull: true }, // Allow NULL
  employee_name: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  event_id: { type: DataTypes.INTEGER, allowNull: false },
});

export const Attendance = sequelize.define('attendance', {
  attendance_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  employee_no: { type: DataTypes.STRING, allowNull: true }, // Allow NULL
  employee_name: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  mode_of_attendance: { type: DataTypes.ENUM('Virtual', 'Onsite'), allowNull: false },
  validation_status: { type: DataTypes.ENUM('Registered', 'Not Registered'), defaultValue: 'Not Registered' },
  event_id: { type: DataTypes.INTEGER, allowNull: false },
});

export const Evaluation = sequelize.define('evaluation', {
  evaluation_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  employee_no: { type: DataTypes.STRING }, // Optional, links to dmag
  employee_name: { type: DataTypes.STRING, allowNull: false }, // Required for walk-ins
  event_id: { type: DataTypes.INTEGER, allowNull: false }, // FK to Event
  // Overall Conduct (each 1-5 or NA)
  objectives_met: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  relevance: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  venue: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  activity: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  value_time_spent: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  overall_rating: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  // Resource Speaker (each 1-5 or NA)
  topic_clear_effective: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  answered_questions: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  presentation_materials: { type: DataTypes.ENUM('1', '2', '3', '4', '5', 'NA'), defaultValue: 'NA' },
  session_helpful: { type: DataTypes.ENUM('Yes', 'No'), defaultValue: 'No' }
});


export function registerModels() {
  Registration.belongsTo(Event, { foreignKey: 'event_id' });
  Event.hasMany(Registration, { foreignKey: 'event_id' });

  Attendance.belongsTo(Event, { foreignKey: 'event_id' });
  Event.hasMany(Attendance, { foreignKey: 'event_id' });
  
  // Relations (add to registerModels function)
  Evaluation.belongsTo(Event, { foreignKey: 'event_id' });
  Event.hasMany(Evaluation, { foreignKey: 'event_id' });
}

export async function getUniqueDepartments() {
  const { sequelize } = await import('./db.js');
  const departments = await sequelize.query(
    `SELECT DISTINCT department FROM dmags WHERE department IS NOT NULL ORDER BY department`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return departments;
}


export async function syncDb() {
  await sequelize.sync();
}