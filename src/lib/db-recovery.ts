import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { replaceDatabase } from './db';
import { initializeSchema } from './db-schema';
import { dataPath } from './data-directory';

export class InvalidDatabaseError extends Error {}

function validateCandidate(filename: string) {
    let candidate: Database.Database | undefined;
    try {
        candidate = new Database(filename, { fileMustExist: true });
        candidate.pragma('trusted_schema = OFF');
        candidate.pragma('foreign_keys = ON');

        // The application schema uses ordinary tables and indexes only.
        const tables = candidate.pragma('table_list') as { type: string }[];
        const invalidObject = candidate.prepare(
            "SELECT 1 FROM sqlite_schema WHERE type IN ('view', 'trigger') LIMIT 1"
        ).get();
        if (invalidObject || tables.some(table => table.type !== 'table')) {
            throw new Error('Objetos incompatíveis no esquema');
        }

        if (candidate.pragma('integrity_check', { simple: true }) !== 'ok') {
            throw new Error('A verificação de integridade do SQLite falhou');
        }
        initializeSchema(candidate, true);
        if ((candidate.pragma('foreign_key_check') as unknown[]).length > 0) {
            throw new Error('A base contém referências inválidas');
        }
        // Publish a standalone file, with no pending WAL from the migration.
        if (candidate.pragma('journal_mode = DELETE', { simple: true }) !== 'delete') {
            throw new Error('A cópia depende do WAL');
        }
    } catch {
        throw new InvalidDatabaseError('A cópia não é um banco SQLite íntegro e compatível com o sistema.');
    } finally {
        candidate?.close();
    }
}

export function recoverDatabase(source: Buffer | string) {
    const stagingDir = fs.mkdtempSync(dataPath('.keys-restore-'));
    const stagedPath = path.join(stagingDir, 'candidate.db');
    try {
        if (Buffer.isBuffer(source)) {
            fs.writeFileSync(stagedPath, source, { flag: 'wx' });
        } else {
            fs.copyFileSync(source, stagedPath, fs.constants.COPYFILE_EXCL);
        }
        validateCandidate(stagedPath);
        replaceDatabase(stagedPath);
    } finally {
        // Only paths created for this candidate are eligible for cleanup.
        try {
            for (const file of fs.readdirSync(stagingDir)) {
                fs.unlinkSync(path.join(stagingDir, file));
            }
            fs.rmdirSync(stagingDir);
        } catch (error) {
            console.error('Erro ao limpar arquivos temporários da recuperação:', error);
        }
    }
}
