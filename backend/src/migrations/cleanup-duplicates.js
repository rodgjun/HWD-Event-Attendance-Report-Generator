// src/migrations/cleanup-duplicates.js
import { sequelize } from '../core/db.js';
import { Registration } from '../core/models.js';

export async function cleanupDuplicates() {
  try {
    // Delete duplicates (keep min reg_id per employee_no + event_id)
    await sequelize.query(`
      DELETE FROM registrations
      WHERE reg_id NOT IN (
        SELECT MIN(reg_id)
        FROM registrations
        GROUP BY employee_no, event_id
      )
    `, { type: sequelize.QueryTypes.DELETE });

    // Drop if exists, then add unique constraint (Postgres-compatible)
    await sequelize.query(`
      ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_employee_no_event_id_unique
    `, { type: sequelize.QueryTypes.RAW });

    await sequelize.query(`
      ALTER TABLE registrations
      ADD CONSTRAINT registrations_employee_no_event_id_unique
      UNIQUE (employee_no, event_id)
    `, { type: sequelize.QueryTypes.RAW });

    console.log('✅ Duplicates cleaned and unique constraint added.');
  } catch (error) {
    console.warn('⚠️ Cleanup skipped (non-critical):', error.message);
    // Continue migration without throwing
  }
}