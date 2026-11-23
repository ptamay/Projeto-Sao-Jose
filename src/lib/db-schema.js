const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'USER',
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    entity_type TEXT DEFAULT 'person',
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    room TEXT,
    item_type TEXT DEFAULT 'key',
    status TEXT DEFAULT 'available', -- 'available', 'in_use'
    employee_id INTEGER,
    observation TEXT,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    key_id INTEGER,
    action TEXT, -- 'withdraw', 'return', 'transfer'
    observation TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    username TEXT,
    FOREIGN KEY(key_id) REFERENCES keys(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    target_user_id INTEGER,
    action TEXT, -- 'PROMOTE', 'DEMOTE'
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_id) REFERENCES users(id),
    FOREIGN KEY(target_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT, -- Captured at time of action
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

const requiredColumns = {
    users: ['id', 'username', 'password_hash', 'role', 'active'],
    employees: ['id', 'name', 'role', 'active', 'entity_type'],
    keys: ['id', 'name', 'room', 'status', 'employee_id', 'observation', 'active', 'item_type'],
    history: ['id', 'employee_id', 'key_id', 'action', 'observation', 'timestamp', 'user_id', 'username'],
    audit_logs: ['id', 'actor_id', 'target_user_id', 'action', 'details', 'timestamp'],
    action_logs: ['id', 'user_id', 'username', 'action', 'target', 'details', 'timestamp'],
    settings: ['key', 'value'],
};

const legacyColumns = {
    users: { active: 'INTEGER DEFAULT 1' },
    employees: { active: 'INTEGER DEFAULT 1', entity_type: "TEXT DEFAULT 'person'" },
    keys: {
        employee_id: 'INTEGER REFERENCES employees(id)',
        observation: 'TEXT',
        active: 'INTEGER DEFAULT 1',
        item_type: "TEXT DEFAULT 'key'",
    },
    history: {
        observation: 'TEXT',
        user_id: 'INTEGER REFERENCES users(id)',
        username: 'TEXT',
    },
};

/** @param {import('better-sqlite3').Database} db */
function initializeSchema(db, requireExisting = false) {
    db.transaction(() => {
        const tables = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").pluck().all());
        if (requireExisting || [...tables].some(name => !String(name).startsWith('sqlite_'))) {
            for (const table of Object.keys(legacyColumns)) {
                if (!tables.has(table)) throw new Error('Tabela obrigatória ausente: ' + table);
            }
        }

        db.exec(schema);

        for (const [table, columns] of Object.entries(requiredColumns)) {
            const tableInfo = /** @type {{name: string; hidden: number; pk: number; type: string}[]} */ (
                db.pragma('table_xinfo(' + table + ')')
            );
            if (requireExisting && table !== 'settings' && !tableInfo.some(
                column => column.name === 'id' && column.pk === 1 && column.type.toUpperCase() === 'INTEGER'
            )) {
                throw new Error('Chave primária incompatível: ' + table);
            }
            const existing = new Set(tableInfo.filter(column => column.hidden === 0).map(column => column.name));
            const additions = /** @type {Record<string, string> | undefined} */ (
                legacyColumns[/** @type {keyof typeof legacyColumns} */ (table)]
            );
            for (const column of columns) {
                if (existing.has(column)) continue;
                const definition = additions?.[column];
                if (!definition) throw new Error('Coluna obrigatória ausente: ' + table + '.' + column);
                db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
            }
        }

        // Confirm the unique key required by the settings upserts.
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
        db.prepare("DELETE FROM settings WHERE key = 'default_reset_password'").run();
    })();
}

module.exports = { initializeSchema };
