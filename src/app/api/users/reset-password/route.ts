import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { logAction } from '@/lib/logger';
import { ChangePasswordSchema } from '@/lib/schemas';

const resetPasswordSchema = ChangePasswordSchema.pick({ userId: true, newPassword: true });

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const session = await verifySession(sessionCookie.value);
        if (!session || session.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const parsed = resetPasswordSchema.safeParse({
            userId: body?.userId ?? body?.targetUserId,
            newPassword: body?.newPassword,
        });
        if (!parsed.success) {
            return NextResponse.json({ error: 'Informe o usuário e uma nova senha com pelo menos 6 caracteres.' }, { status: 400 });
        }

        const { userId, newPassword } = parsed.data;
        if (!newPassword.trim() || Buffer.byteLength(newPassword, 'utf8') > 72) {
            return NextResponse.json({ error: 'Informe uma senha válida de até 72 bytes.' }, { status: 400 });
        }

        const targetUser = db.prepare('SELECT username FROM users WHERE id = ? AND active = 1').get(userId) as { username: string } | undefined;
        if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

        const newHash = await bcrypt.hash(newPassword, 10);
        const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND username = ? AND active = 1')
            .run(newHash, userId, targetUser.username);
        if (!result.changes) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

        logAction(session.id, session.username, 'RESET_PASSWORD', targetUser.username, 'Senha redefinida por um administrador.');
        return NextResponse.json({ success: true, message: 'Senha redefinida com sucesso.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
