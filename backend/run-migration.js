#!/usr/bin/env node

import 'dotenv/config';
import { syncDb, registerModels } from './src/core/models.js';
import { cleanupDuplicates } from './src/migrations/cleanup-duplicates.js';

console.log('Starting database migration...');

async function migrate() {
  try {
    // Register model associations
    registerModels();
    
    // Sync tables (create/update schema)
    await syncDb({ alter: true }); // alter: true updates without dropping data; set force: true only for fresh start
    
    // Run custom migrations
    await cleanupDuplicates();
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();