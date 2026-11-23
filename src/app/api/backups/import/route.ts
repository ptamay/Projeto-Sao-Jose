import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { DatabaseBusyError } from '@/lib/db';
import { recoverDatabase, InvalidDatabaseError } from '@/lib/db-recovery';
import { logAction } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(sessionCookie.value);
        if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const formData = await request.formData().catch(() => null);
        const file = formData?.get('file');
        if (!(file instanceof File) || file.size === 0 || !file.name.toLowerCase().endsWith('.db')) {
            return NextResponse.json({ error: 'Envie um arquivo .db válido.' }, { status: 400 });
        }

        recoverDatabase(Buffer.from(await file.arrayBuffer()));
        logAction(session.id, session.username, 'IMPORT_DATABASE', file.name, 'Banco de dados importado manualmente pelo upload de arquivo.');
        return NextResponse.json({ success: true, message: 'Banco de dados importado com sucesso.' });
    } catch (error) {
        if (error instanceof InvalidDatabaseError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof DatabaseBusyError) {
            return NextResponse.json({ error: 'A base está ocupada. Tente novamente após concluir a operação em andamento.' }, { status: 409 });
        }
        console.error('[IMPORT SYSTEM ERROR]', error);
        return NextResponse.json({ error: 'Erro ao importar o banco de dados.' }, { status: 500 });
    }
}
