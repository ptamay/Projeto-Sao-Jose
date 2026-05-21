import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { logAction } from '@/lib/logger';
import { verifySession } from '@/lib/session';
import { UserSchema } from '@/lib/schemas';

// Get all users
export async function GET() {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(sessionCookie.value);
        if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const users = db.prepare('SELECT id, username, role FROM users WHERE active = 1').all();
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

// Create user
export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const currentUser = await verifySession(sessionCookie.value);
        if (!currentUser || currentUser.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const parseResult = UserSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 });
        }
        
        const { username, password, role } = parseResult.data;
        
        const finalRole = role === 'ADMIN' ? 'ADMIN' : 'PORTEIRO';

        const existing = db.prepare('SELECT id, active FROM users WHERE username = ?').get(username) as any;
        if (existing) {
            if (existing.active === 1) {
                return NextResponse.json({ error: 'Este usuário já está cadastrado e ativo' }, { status: 400 });
            } else {
                // Scenario B: User exists but is inactive
                const hash = await bcrypt.hash(password, 10);
                const stmt = db.prepare('UPDATE users SET active = 1, password_hash = ?, role = ? WHERE id = ?');
                stmt.run(hash, finalRole, existing.id);

                if (currentUser) {
                    logAction(currentUser.id, currentUser.username, 'REACTIVATE_USER', username, 'User reactivated with new data');
                }

                return NextResponse.json({
                    id: existing.id,
                    username,
                    role: finalRole,
                    message: 'Usuário reativado com sucesso',
                    reactivated: true
                });
            }
        }

        const hash = await bcrypt.hash(password, 10);
        const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        const info = stmt.run(username, hash, finalRole);

        if (currentUser) {
            logAction(currentUser.id, currentUser.username, 'CREATE_USER', username, `New user created`);
        }

        return NextResponse.json({ id: info.lastInsertRowid, username, role: finalRole });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// Delete user
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

        // Check current session
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        let currentUserId;
        let currentUsername;
        try {
            const session = await verifySession(sessionCookie.value);
            if (!session) throw new Error('Invalid session');
            currentUserId = session.id;
            currentUsername = session.username;
        } catch (e) {
            return NextResponse.json({ error: 'Invalid session format' }, { status: 401 });
        }

        if (id === currentUserId) {
            return NextResponse.json({ error: 'Você não pode excluir a si mesmo.' }, { status: 403 });
        }

        const targetUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
        const targetUser = targetUserStmt.get(id) as any;

        if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

        if (targetUser.role === 'ADMIN') {
            const adminCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'");
            const result = adminCountStmt.get() as any;
            if (result.count <= 1) {
                return NextResponse.json({ error: 'Não é possível excluir o único administrador.' }, { status: 403 });
            }
        }

        const stmt = db.prepare('UPDATE users SET active = 0 WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Action Log
        logAction(currentUserId, currentUsername, 'DELETE_USER', targetUser.username, `Deleted user ${targetUser.username} (${targetUser.role})`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
