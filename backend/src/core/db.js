import { Sequelize } from 'sequelize';

const rawDialect = process.env.DB_DIALECT || 'postgres';  // Default to postgres
// Guard against misformatted env like: "postgres, DB_HOST=localhost, ..."
const dialect = rawDialect.split(',')[0].trim().toLowerCase();

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'hwd_db',
  process.env.DB_USER || 'postgres',  // Default to postgres user
  process.env.DB_PASSWORD || 'Fakerisme068!',
  {
    host: process.env.DB_HOST || 'localhost',  // localhost is standard
    port: Number(process.env.DB_PORT) || (dialect === 'postgres' ? 5432 : 3306),  // Dialect-aware port
    dialect,
    storage: dialect === 'sqlite' ? (process.env.DB_STORAGE || 'hwd.sqlite') : undefined,
    logging: false,
  }
);