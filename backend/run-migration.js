#!/usr/bin/env node

import 'dotenv/config';
import { cleanupDuplicates } from './src/migrations/cleanup-duplicates.js';

console.log('Starting duplicate cleanup migration...');

try {
  await cleanupDuplicates();
  console.log('✅ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
