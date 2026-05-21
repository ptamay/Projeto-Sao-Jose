import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';
import HistoryClient from './HistoryClient';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const resolvedParams = await searchParams;
    const page = parseInt(resolvedParams?.page || '1', 10) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    const sessionCookie = (await cookies()).get('session');
    if (!sessionCookie) redirect('/login');

    let session;
    try {
        session = await verifySession(sessionCookie.value);
        if (!session) throw new Error();
    } catch { redirect('/login'); }

    const history = db.prepare(`
        SELECT h.id, h.action, h.timestamp, COALESCE(h.username, u.username) as username,
               k.name as key_name, k.room, e.name as employee_name
        FROM history h
        LEFT JOIN keys k ON h.key_id = k.id
        LEFT JOIN employees e ON h.employee_id = e.id
        LEFT JOIN users u ON h.user_id = u.id
        ORDER BY h.timestamp DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const countRow = db.prepare('SELECT COUNT(*) as total FROM history').get() as { total: number };
    const totalPages = Math.ceil(countRow.total / limit);

    return <HistoryClient history={history} userRole={session.role} username={session.username} currentPage={page} totalPages={totalPages} />;
}
