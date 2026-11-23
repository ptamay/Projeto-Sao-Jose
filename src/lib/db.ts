import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeSchema } from './db-schema';

const globalWithDb = globalThis as typeof globalThis & {
    db?: Database.Database;
    csjActiveBackups?: number;
};

const dbPath = path.resolve(process.cwd(), 'keys.db');
const previousPath = path.resolve(process.cwd(), '.keys-restore-previous.db');

export class DatabaseBusyError extends Error {}

function openDatabase() {
    const instance = new Database(dbPath);
    try {
        instance.pragma('trusted_schema = OFF');
        instance.pragma('foreign_keys = ON');
        initializeSchema(instance);
        instance.pragma('journal_mode = WAL');
        return instance;
    } catch (error) {
        instance.close();
        throw error;
    }
}

export function initializeDatabase() {
    if (globalWithDb.db?.open) return globalWithDb.db;

    // Recover the original if the process stopped between the two renames.
    if (!fs.existsSync(dbPath) && fs.existsSync(previousPath)) {
        fs.renameSync(previousPath, dbPath);
    }
    const instance = openDatabase();
    globalWithDb.db = instance;
    return instance;
}

export async function backupDatabase(destination: string) {
    const active = initializeDatabase();
    globalWithDb.csjActiveBackups = (globalWithDb.csjActiveBackups ?? 0) + 1;
    try {
        await active.backup(destination);
    } finally {
        globalWithDb.csjActiveBackups--;
    }
}

export function replaceDatabase(stagedPath: string) {
    if ((globalWithDb.csjActiveBackups ?? 0) > 0 || fs.existsSync(previousPath)) {
        throw new DatabaseBusyError();
    }

    const active = initializeDatabase();
    const [checkpoint] = active.pragma('wal_checkpoint(TRUNCATE)') as { busy: number }[];
    if (checkpoint.busy) throw new DatabaseBusyError();

    active.close();
    globalWithDb.db = undefined;

    let parkedOriginal = false;
    let installedCandidate = false;
    try {
        // SQLite removes its own sidecars on close. If they remain, another
        // connection may still own them.
        if (fs.existsSync(dbPath + '-wal') || fs.existsSync(dbPath + '-shm')) {
            throw new DatabaseBusyError();
        }
        fs.renameSync(dbPath, previousPath);
        parkedOriginal = true;
        fs.renameSync(stagedPath, dbPath);
        installedCandidate = true;
        globalWithDb.db = openDatabase();
    } catch (error) {
        if (installedCandidate) fs.renameSync(dbPath, stagedPath);
        if (parkedOriginal) fs.renameSync(previousPath, dbPath);
        globalWithDb.db = openDatabase();
        throw error;
    }

    try {
        fs.unlinkSync(previousPath);
    } catch (error) {
        console.error('Erro ao remover a cópia de reversão após a restauração:', error);
    }
}

const dbProxy = new Proxy({} as Database.Database, {
    get(_target, prop: keyof Database.Database) {
        const db = initializeDatabase();
        const value = db[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    }
});

export default dbProxy;
