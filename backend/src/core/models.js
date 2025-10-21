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

export function registerModels() {
  Registration.belongsTo(Event, { foreignKey: 'event_id' });
  Event.hasMany(Registration, { foreignKey: 'event_id' });

  Attendance.belongsTo(Event, { foreignKey: 'event_id' });
  Event.hasMany(Attendance, { foreignKey: 'event_id' });
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