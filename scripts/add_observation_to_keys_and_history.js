const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'keys.db');
const db = new Database(dbPath);

console.log('Running migration to add observation column to keys and history tables...');

try {
  // Check if observation exists in keys
  const keysColumns = db.pragma('table_info(keys)');
  const hasKeysObservation = keysColumns.some(c => c.name === 'observation');
  
  if (!hasKeysObservation) {
    db.exec('ALTER TABLE keys ADD COLUMN observation TEXT;');
    console.log('Added observation column to keys table.');
  } else {
    console.log('keys table already has observation column.');
  }

  // Check if observation exists in history
  const historyColumns = db.pragma('table_info(history)');
  const hasHistoryObservation = historyColumns.some(c => c.name === 'observation');

  if (!hasHistoryObservation) {
    db.exec('ALTER TABLE history ADD COLUMN observation TEXT;');
    console.log('Added observation column to history table.');
  } else {
    console.log('history table already has observation column.');
  }

  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
}
