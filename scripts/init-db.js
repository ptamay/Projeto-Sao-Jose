const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const { initializeSchema } = require('../src/lib/db-schema');

const dbPath = path.resolve(process.cwd(), 'keys.db');
const db = new Database(dbPath);

console.log('Initializing database at:', dbPath);

initializeSchema(db);

// Create default admin user if not exists
const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
const user = stmt.get('admin');

if (!user) {
  const hash = bcrypt.hashSync('admin', 10);
  const insert = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
  insert.run('admin', hash, 'ADMIN');
  console.log('Initial administrator created. Change the initial password before use.');
} else {
  console.log('Admin user already exists.');
}

console.log('Database initialized successfully.');
db.close();
