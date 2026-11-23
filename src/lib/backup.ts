import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import cron from 'node-cron';
import db, { backupDatabase } from './db';
import { dataPath } from './data-directory';

const backupsDir = dataPath('backups');
const backupFilenamePattern = /^keys_backup_\d{4}-\d{2}-\d{2}(?:_\d{13}_[0-9a-f-]{36})?\.db$/;
const globalWithBackup = globalThis as typeof globalThis & {
    csjBackupQueue?: Promise<void>;
    csjBackupCronStarted?: boolean;
};

function localDay(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function getBackupPath(filename: unknown) {
    if (typeof filename !== 'string' || !backupFilenamePattern.test(filename) || !filename.endsWith('.db')) {
        return null;
    }
    return path.join(backupsDir, filename);
}

export function createBackup(mode: 'manual' | 'automatic') {
    const job = (globalWithBackup.csjBackupQueue ?? Promise.resolve()).then(async () => {
        let stagingDir: string | undefined;
        try {
            fs.mkdirSync(backupsDir, { recursive: true });
            const now = new Date();
            const day = localDay(now);
            const suffix = mode === 'manual' ? `_${now.getTime()}_${randomUUID()}` : '';
            const filename = `keys_backup_${day}${suffix}.db`;
            const destination = path.join(backupsDir, filename);
            if (mode === 'automatic' && fs.existsSync(destination)) return true;

            const row = db.prepare("SELECT value FROM settings WHERE key = 'backup_retention_count'").get() as { value: string } | undefined;
            const retention = Number(row?.value);
            const limit = Number.isInteger(retention) && retention >= 1 && retention <= 50 ? retention : 3;

            stagingDir = fs.mkdtempSync(path.join(backupsDir, '.backup-'));
            const stagedPath = path.join(stagingDir, 'snapshot.db');
            await backupDatabase(stagedPath);
            fs.renameSync(stagedPath, destination);
            const otherBackups = getAvailableBackups().filter(backup => backup.filename !== filename);
            for (const backup of otherBackups.slice(limit - 1)) deleteBackup(backup.filename);
            return true;
        } catch (error) {
            console.error('[Backup] Erro ao criar cópia:', error);
            return false;
        } finally {
            if (stagingDir) {
                try {
                    for (const file of fs.readdirSync(stagingDir)) {
                        fs.unlinkSync(path.join(stagingDir, file));
                    }
                    fs.rmdirSync(stagingDir);
                } catch (error) {
                    console.error('[Backup] Erro ao limpar a área temporária:', error);
                }
            }
        }
    });
    globalWithBackup.csjBackupQueue = job.then(() => undefined);
    return job;
}

export function getAvailableBackups() {
    try {
        if (!fs.existsSync(backupsDir)) return [];
        return fs.readdirSync(backupsDir, { withFileTypes: true })
            .filter(file => file.isFile() && getBackupPath(file.name))
            .map(file => {
                const stat = fs.statSync(path.join(backupsDir, file.name));
                return { filename: file.name, createdAt: stat.mtime, size: stat.size };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error('[Backup] Erro ao listar cópias:', error);
        return [];
    }
}

export function deleteBackup(filename: unknown) {
    const filePath = getBackupPath(filename);
    if (!filePath) return false;
    try {
        if (!fs.lstatSync(filePath, { throwIfNoEntry: false })?.isFile()) return false;
        fs.unlinkSync(filePath);
        return true;
    } catch (error) {
        console.error('[Backup] Erro ao excluir cópia:', error);
        return false;
    }
}

export function startCronJobs() {
    if (globalWithBackup.csjBackupCronStarted) return;
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        try {
            const row = db.prepare("SELECT value FROM settings WHERE key = 'backup_time'").get() as { value: string } | undefined;
            if (currentHHMM === (row?.value || '03:00')) await createBackup('automatic');
        } catch (error) {
            console.error('[Cron] Erro ao verificar horário de backup:', error);
        }
    });
    globalWithBackup.csjBackupCronStarted = true;
}
