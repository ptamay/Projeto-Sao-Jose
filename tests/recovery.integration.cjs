const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const project = path.resolve(__dirname, '..');
const initialPassword = 'Sintetica-Teste-814';
const newPassword = 'Sintetica-Redefinida-102';
const legacySecret = 'Sintetica-Legado-599';

const runServer = `
    const next = require('next');
    const http = require('node:http');
    const server = http.createServer();
    const app = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1', httpServer: server, webpack: true });
    app.prepare().then(() => {
        server.on('request', app.getRequestHandler());
        server.listen(0, '127.0.0.1', () => console.log('TEST_SERVER_PORT=' + server.address().port));
    }).catch(error => { console.error(error); process.exitCode = 1; });
`;

function usingDb(filename, action, options) {
    const db = new Database(filename, options);
    try {
        return action(db);
    } finally {
        db.close();
    }
}

function seedUsers(db, hash) {
    const add = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    add.run('admin-teste', hash, 'ADMIN');
    add.run('porteiro-teste', hash, 'PORTEIRO');
    add.run('usuario-teste', hash, 'USER');
}

test('recuperação e acesso com SQLite sintético pelas rotas Next.js', { timeout: 120_000 }, async () => {
    const temp = fs.realpathSync(os.tmpdir());
    const dir = fs.mkdtempSync(path.join(temp, 'csj-recovery-test-'));
    const databasePath = path.join(dir, 'keys.db');
    const backupDir = path.join(dir, 'backups');
    let server;
    let serverLog = '';

    async function request(endpoint, status, { cookie, body, method = 'GET' } = {}) {
        const headers = new Headers();
        if (cookie) headers.set('Cookie', cookie);
        if (body && !(body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(body);
        }
        const response = await fetch(baseUrl + endpoint, {
            headers, method, body, signal: AbortSignal.timeout(30_000),
        });
        const payload = await response.text();
        assert.equal(response.status, status, endpoint + ' → ' + payload);
        return { data: JSON.parse(payload), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }

    const post = (endpoint, status, cookie, body) => request(endpoint, status, { cookie, body, method: 'POST' });
    const login = (username, password = initialPassword, status = 200) =>
        post('/api/auth/login', status, undefined, { username, password });
    const list = async cookie => (await request('/api/backups', 200, { cookie })).data;
    const activeItem = () => usingDb(databasePath, db => db.prepare('SELECT status, employee_id FROM keys WHERE id = 1').get());
    const upload = contents => {
        const form = new FormData();
        form.append('file', new Blob([contents]), 'copia.db');
        return form;
    };
    let baseUrl;

    try {
        const cliDirectory = path.join(dir, 'cli');
        fs.mkdirSync(cliDirectory);
        const cli = spawnSync(process.execPath, [path.join(project, 'scripts', 'init-db.js')], {
            cwd: cliDirectory,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 15_000,
        });
        assert.equal(cli.status, 0, cli.error?.message ?? cli.stderr);
        usingDb(path.join(cliDirectory, 'keys.db'), db => {
            assert.equal(db.prepare("SELECT role FROM users WHERE username = 'admin'").pluck().get(), 'ADMIN');
            db.prepare('SELECT item_type FROM keys');
            db.prepare('SELECT entity_type FROM employees');
            db.prepare('SELECT key, value FROM settings');
        }, { fileMustExist: true });

        for (const entry of ['src', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts']) {
            fs.cpSync(path.join(project, entry), path.join(dir, entry), { recursive: true });
        }
        fs.symlinkSync(path.join(project, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
        assert.equal(fs.existsSync(databasePath), false);

        const fontMock = path.join(dir, 'fonts.cjs');
        fs.writeFileSync(fontMock, 'module.exports = new Proxy({}, { get: () => "@font-face { font-family: Inter; src: local(Arial); }" });');
        server = spawn(process.execPath, ['-e', runServer], {
            cwd: dir,
            windowsHide: true,
            env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontMock },
        });
        server.stdout.on('data', chunk => { serverLog = (serverLog + chunk).slice(-16000); });
        server.stderr.on('data', chunk => { serverLog = (serverLog + chunk).slice(-16000); });

        const port = await new Promise((resolve, reject) => {
            const deadline = setTimeout(() => reject(new Error('Servidor de teste não iniciou.')), 45_000);
            server.once('error', error => { clearTimeout(deadline); reject(error); });
            server.once('exit', code => { clearTimeout(deadline); reject(new Error('Servidor encerrou: ' + code)); });
            server.stdout.on('data', () => {
                const match = serverLog.match(/TEST_SERVER_PORT=(\d+)/);
                if (match) {
                    clearTimeout(deadline);
                    resolve(Number(match[1]));
                }
            });
        });
        baseUrl = 'http://127.0.0.1:' + port;

        const hash = bcrypt.hashSync(initialPassword, 4);
        usingDb(databasePath, db => {
            seedUsers(db, hash);
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('default_reset_password', legacySecret);
            db.exec("INSERT INTO employees (name, entity_type) VALUES ('Pessoa sintética', 'person'), ('Local sintético', 'location')");
            db.exec("INSERT INTO keys (name, status, item_type) VALUES ('Equipamento sintético', 'available', 'equipment')");
        }, { fileMustExist: true });

        const admin = (await login('admin-teste')).cookie;
        const porter = (await login('porteiro-teste')).cookie;
        const user = (await login('usuario-teste')).cookie;
        for (const cookie of [undefined, admin, porter, user]) {
            const config = (await request('/api/settings', 200, { cookie })).data;
            assert.deepEqual(Object.keys(config).sort(), ['autoLogoutTime', 'backupCount', 'backupTime']);
        }
        for (const cookie of [porter, user]) {
            await post('/api/users/reset-password', 403, cookie, { userId: 3, newPassword });
            await post('/api/backups', 401, cookie);
            await post('/api/backups/import', 403, cookie, upload('inválido'));
            await post('/api/backups/restore', 403, cookie, { filename: 'keys_backup_2000-01-01.db' });
        }
        await post('/api/users/reset-password', 401, undefined, { userId: 3, newPassword });
        await post('/api/users/reset-password', 400, admin, { targetUserId: 3 });
        await post('/api/users/reset-password', 400, admin, { userId: 3, newPassword: 'á'.repeat(40) });
        await post('/api/users/reset-password', 200, admin, { userId: 3, newPassword });
        await login('usuario-teste', initialPassword, 401);
        await login('usuario-teste', newPassword);

        await post('/api/transactions', 200, porter, { action: 'withdraw', key_id: 1, employee_id: 1 });
        assert.ok(fs.statSync(databasePath + '-wal').size > 32);
        await post('/api/backups', 200, admin);
        const [first] = await list(admin);

        await post('/api/transactions', 200, porter, { action: 'transfer', key_id: 1, employee_id: 2 });
        await post('/api/backups', 200, admin);
        const backups = await list(admin);
        assert.equal(backups.length, 2);
        const second = backups.find(backup => backup.filename !== first.filename);
        assert.ok(second);

        for (const [backup, holder] of [[first, 1], [second, 2]]) {
            usingDb(path.join(backupDir, backup.filename), db => {
                assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
                assert.equal(db.prepare('SELECT employee_id FROM keys WHERE id = 1').pluck().get(), holder);
            }, { readonly: true, fileMustExist: true });
        }

        await post('/api/backups/import', 400, admin, upload('arquivo inválido'));
        const unrelated = path.join(dir, 'unrelated.db');
        usingDb(unrelated, db => db.exec('CREATE TABLE unrelated (id INTEGER)'));
        await post('/api/backups/import', 400, admin, upload(fs.readFileSync(unrelated)));
        const corruptName = 'keys_backup_2000-01-01.db';
        fs.writeFileSync(path.join(backupDir, corruptName), fs.readFileSync(path.join(backupDir, second.filename)).subarray(0, 150));
        await post('/api/backups/restore', 400, admin, { filename: corruptName });
        assert.deepEqual(activeItem(), { status: 'in_use', employee_id: 2 });

        const reader = new Database(databasePath, { readonly: true, fileMustExist: true });
        try {
            reader.exec('BEGIN');
            assert.equal(reader.prepare('SELECT employee_id FROM keys WHERE id = 1').pluck().get(), 2);
            await post('/api/transactions', 200, porter, { action: 'return', key_id: 1 });
            await post('/api/backups/restore', 409, admin, { filename: second.filename });
        } finally {
            reader.close();
        }
        assert.deepEqual(activeItem(), { status: 'available', employee_id: null });
        await post('/api/backups/restore', 200, admin, { filename: second.filename });
        assert.deepEqual(activeItem(), { status: 'in_use', employee_id: 2 });
        await post('/api/transactions', 200, porter, { action: 'return', key_id: 1 });
        usingDb(databasePath, db => {
            const history = db.prepare('SELECT action, employee_id, username FROM history ORDER BY id').all();
            assert.deepEqual(history.map(row => [row.action, row.employee_id, row.username]), [
                ['withdraw', 1, 'porteiro-teste'],
                ['transfer', 2, 'porteiro-teste'],
                ['return', 2, 'porteiro-teste'],
            ]);
        });
        await request('/api/backups', 200, { method: 'DELETE', cookie: admin, body: { filename: first.filename } });

        const legacy = path.join(dir, 'legacy.db');
        usingDb(legacy, db => {
            db.exec(`
                CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT);
                CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, role TEXT);
                CREATE TABLE keys (id INTEGER PRIMARY KEY, name TEXT, room TEXT, status TEXT);
                CREATE TABLE history (id INTEGER PRIMARY KEY, employee_id INTEGER, key_id INTEGER, action TEXT, timestamp TEXT);
                CREATE TABLE settings (id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
                INSERT INTO employees VALUES (1, 'Legado sintético', 'Professor');
                INSERT INTO keys VALUES (1, 'Chave legada', 'Sala', 'available');
                INSERT INTO history VALUES (1, 1, 1, 'return', '2025-01-01');
            `);
            seedUsers(db, hash);
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('default_reset_password', legacySecret);
        });
        await post('/api/backups/import', 200, admin, upload(fs.readFileSync(legacy)));
        usingDb(databasePath, db => {
            assert.equal(db.prepare("SELECT COUNT(*) FROM settings WHERE key = 'default_reset_password'").pluck().get(), 0);
            assert.equal(db.prepare('SELECT item_type FROM keys WHERE id = 1').pluck().get(), 'key');
            assert.equal(db.prepare('SELECT entity_type FROM employees WHERE id = 1').pluck().get(), 'person');
            assert.equal(db.prepare('SELECT COUNT(*) FROM history WHERE id = 1 AND action = ?').pluck().get('return'), 1);
            assert.equal(db.prepare("SELECT COUNT(*) FROM action_logs WHERE action = 'IMPORT_DATABASE'").pluck().get(), 1);
        });
        await post('/api/transactions', 200, porter, { action: 'withdraw', key_id: 1, employee_id: 1 });

        usingDb(databasePath, db => {
            db.exec("INSERT INTO keys (name, item_type) VALUES ('Rádio % reserva', 'equipment')");
            const add = db.prepare("INSERT INTO history (key_id, action, timestamp, username) VALUES (?, 'return', ?, ?)");
            db.transaction(() => {
                add.run(2, '2001-01-01T08:00:00Z', 'porteiro-teste');
                for (let i = 0; i < 51; i++) add.run(1, '2025-01-02T08:00:00Z', 'porteiro-teste');
            })();
        });

        async function historyPage(query = '') {
            const response = await fetch(baseUrl + '/history' + query, {
                headers: { Cookie: porter }, signal: AbortSignal.timeout(30_000),
            });
            assert.equal(response.status, 200);
            return (await response.text()).replace(/<!--.*?-->/g, '');
        }

        assert.doesNotMatch(await historyPage(), /Rádio % reserva/);
        const oldMatch = await historyPage('?q=RADIO+%25&page=9');
        assert.match(oldMatch, /Rádio % reserva/);
        assert.match(oldMatch, /1 registro · Página 1 de 1/);
        assert.doesNotMatch(oldMatch, /Chave legada/);
        assert.match(await historyPage('?q=chave+legada&page=2'), /53 registros · Página 2 de 2/);
    } catch (error) {
        throw new Error(serverLog, { cause: error });
    } finally {
        if (server?.pid && server.exitCode === null && server.signalCode === null) {
            const exited = once(server, 'exit');
            server.kill();
            await exited;
        }
        assert.equal(path.dirname(fs.realpathSync(dir)), temp);
        assert.ok(path.basename(dir).startsWith('csj-recovery-test-'));
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
});
