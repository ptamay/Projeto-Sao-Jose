const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('node:fs');
const { initializeSchema } = require('../src/lib/db-schema');
const { dataPath } = require('../src/lib/data-directory');

const dbPath = dataPath('keys.db');
const freshInstall = process.argv.includes('--fresh-install');
let initialPassword = 'admin';
if (freshInstall) {
    if (fs.existsSync(dbPath)) {
        throw new Error('A instalação nova requer uma pasta de dados sem keys.db.');
    }
    initialPassword = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
    if (initialPassword.trim().length < 12 || Buffer.byteLength(initialPassword, 'utf8') > 72) {
        throw new Error('A senha inicial precisa ter ao menos 12 caracteres e até 72 bytes em UTF-8.');
    }
}
const db = new Database(dbPath);

try {
    console.log('Initializing database at:', dbPath);
    db.transaction(() => {
        initializeSchema(db);
        const user = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (user) return;
        const hash = bcrypt.hashSync(initialPassword, 10);
        db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'ADMIN');
        console.log('Initial administrator created.');
    })();
    console.log('Database initialized successfully.');
} finally {
    db.close();
}
