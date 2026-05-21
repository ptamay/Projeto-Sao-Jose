const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(process.cwd(), 'keys.db');
const db = new Database(dbPath);

console.log('Running migrations on:', dbPath);

try {
    // Add item_type to keys if not exists
    const keysInfo = db.prepare("PRAGMA table_info(keys)").all();
    const hasItemType = keysInfo.some(col => col.name === 'item_type');
    
    if (!hasItemType) {
        db.exec("ALTER TABLE keys ADD COLUMN item_type TEXT DEFAULT 'key'");
        console.log('Added item_type to keys table.');
    } else {
        console.log('item_type already exists in keys.');
    }

    // Add entity_type to employees if not exists
    const empInfo = db.prepare("PRAGMA table_info(employees)").all();
    const hasEntityType = empInfo.some(col => col.name === 'entity_type');
    
    if (!hasEntityType) {
        db.exec("ALTER TABLE employees ADD COLUMN entity_type TEXT DEFAULT 'person'");
        console.log('Added entity_type to employees table.');
    } else {
        console.log('entity_type already exists in employees.');
    }
} catch (e) {
    console.error('Migration failed:', e);
}

console.log('Migration complete.');
