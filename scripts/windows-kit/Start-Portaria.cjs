const { Console } = require('node:console');
const fs = require('node:fs');
const path = require('node:path');

const [, , dataDirectory, port = '3000'] = process.argv;
if (!dataDirectory || !path.isAbsolute(dataDirectory)) {
    throw new Error('Informe o caminho absoluto da pasta de dados.');
}
if (!fs.existsSync(path.join(dataDirectory, 'keys.db'))) {
    throw new Error('Base ausente. Verifique a instalação e o caminho da pasta de dados.');
}
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Porta inválida.');
}

const logDirectory = path.join(dataDirectory, 'logs');
fs.mkdirSync(logDirectory, { recursive: true });
const logFile = path.join(logDirectory, 'portaria.log');
if (fs.existsSync(logFile) && fs.statSync(logFile).size >= 5 * 1024 * 1024) {
    fs.rmSync(path.join(logDirectory, 'portaria-anterior.log'), { force: true });
    fs.renameSync(logFile, path.join(logDirectory, 'portaria-anterior.log'));
}
const log = fs.createWriteStream(logFile, { flags: 'a' });
globalThis.console = new Console({ stdout: log, stderr: log });
process.on('uncaughtExceptionMonitor', error => {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${error.stack || error}\n`);
});

process.env.CSJ_DATA_DIR = dataDirectory;
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT = port;
process.env.NEXT_TELEMETRY_DISABLED = '1';
console.info(`${new Date().toISOString()} Iniciando Controle Integrado de Portaria na porta ${port}.`);
require('./app/server.js');
