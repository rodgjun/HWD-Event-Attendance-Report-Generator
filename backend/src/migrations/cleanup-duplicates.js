import { sequelize } from '../core/db.js';
import { Registration, Attendance, Event } from '../core/models.js';

export async function cleanupDuplicates() {
  try {
    console.log('Starting duplicate cleanup...');
    
    // Clean up duplicate registrations
    console.log('Cleaning up duplicate registrations...');
    const duplicateRegistrations = await sequelize.query(`
      SELECT employee_no, event_id, COUNT(*) as count
      FROM registrations 
      WHERE employee_no IS NOT NULL
      GROUP BY employee_no, event_id 
      HAVING COUNT(*) > 1
    `, { type: sequelize.QueryTypes.SELECT });

    for (const duplicate of duplicateRegistrations) {
      console.log(`Found ${duplicate.count} duplicates for employee ${duplicate.employee_no} in event ${duplicate.event_id}`);
      
      // Keep only the first record, delete the rest
      const records = await Registration.findAll({
        where: {
          employee_no: duplicate.employee_no,
          event_id: duplicate.event_id
        },
        order: [['reg_id', 'ASC']]
      });
      
      // Delete all but the first record
      for (let i = 1; i < records.length; i++) {
        await records[i].destroy();
        console.log(`Deleted duplicate registration ID: ${records[i].reg_id}`);
      }
    }

    // Clean up duplicate attendance
    console.log('Cleaning up duplicate attendance...');
    const duplicateAttendance = await sequelize.query(`
      SELECT employee_no, event_id, COUNT(*) as count
      FROM attendances 
      WHERE employee_no IS NOT NULL
      GROUP BY employee_no, event_id 
      HAVING COUNT(*) > 1
    `, { type: sequelize.QueryTypes.SELECT });

    for (const duplicate of duplicateAttendance) {
      console.log(`Found ${duplicate.count} duplicates for employee ${duplicate.employee_no} in event ${duplicate.event_id}`);
      
      // Keep only the first record, delete the rest
      const records = await Attendance.findAll({
        where: {
          employee_no: duplicate.employee_no,
          event_id: duplicate.event_id
        },
        order: [['attendance_id', 'ASC']]
      });
      
      // Delete all but the first record
      for (let i = 1; i < records.length; i++) {
        await records[i].destroy();
        console.log(`Deleted duplicate attendance ID: ${records[i].attendance_id}`);
      }
    }

    console.log('Duplicate cleanup completed successfully!');
    
    // Now add the unique constraints
    console.log('Adding unique constraints...');
    
    try {
      await sequelize.query(`
        ALTER TABLE registrations 
        ADD UNIQUE INDEX registrations_employee_no_event_id (employee_no, event_id)
      `);
      console.log('Added unique constraint for registrations');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Unique constraint for registrations already exists');
      } else {
        throw error;
      }
    }

    try {
      await sequelize.query(`
        ALTER TABLE attendances 
        ADD UNIQUE INDEX attendance_employee_no_event_id (employee_no, event_id)
      `);
      console.log('Added unique constraint for attendance');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Unique constraint for attendance already exists');
      } else {
        throw error;
      }
    }

    try {
      await sequelize.query(`
        ALTER TABLE events 
        ADD UNIQUE INDEX events_type_name (event_type, event_name)
      `);
      console.log('Added unique constraint for events');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('Unique constraint for events already exists');
      } else {
        throw error;
      }
    }

    console.log('All unique constraints added successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicates()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
