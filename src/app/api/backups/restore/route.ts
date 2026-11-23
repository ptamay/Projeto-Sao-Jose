import fs from 'fs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { DatabaseBusyError } from '@/lib/db';
import { recoverDatabase, InvalidDatabaseError } from '@/lib/db-recovery';
import { logAction } from '@/lib/logger';
import { getBackupPath } from '@/lib/backup';

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(sessionCookie.value);
        if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json().catch(() => null);
        const filename = body?.filename;
        const backupPath = getBackupPath(filename);
        if (!backupPath) return NextResponse.json({ error: 'Nome de arquivo inválido' }, { status: 400 });
        if (!fs.lstatSync(backupPath, { throwIfNoEntry: false })?.isFile()) {
            return NextResponse.json({ error: 'Arquivo de backup não encontrado' }, { status: 404 });
        }

        recoverDatabase(backupPath);
        logAction(session.id, session.username, 'RESTORE_BACKUP', filename, 'Sistema inteiro restaurado a partir de um backup.');
        return NextResponse.json({ success: true, message: 'Restauração de sistema concluída com sucesso.' });
    } catch (error) {
        if (error instanceof InvalidDatabaseError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof DatabaseBusyError) {
            return NextResponse.json({ error: 'A base está ocupada. Tente novamente após concluir a operação em andamento.' }, { status: 409 });
        }
        console.error('[RESTORE SYSTEM ERROR]', error);
        return NextResponse.json({ error: 'Erro ao restaurar o banco de dados.' }, { status: 500 });
    }
}
