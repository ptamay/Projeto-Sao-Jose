import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';
import HistoryClient from './HistoryClient';
import { normalizeSearch } from '@/lib/search';
import type { HistoryItem } from './HistoryClient';

export default async function HistoryPage({ searchParams }: {
    searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
    const sessionCookie = (await cookies()).get('session');
    if (!sessionCookie) redirect('/login');

    let session;
    try {
        session = await verifySession(sessionCookie.value);
        if (!session) throw new Error();
    } catch { redirect('/login'); }

    const params = await searchParams;
    const search = typeof params.q === 'string' ? params.q.trim() : '';
    const normalized = normalizeSearch(search);
    const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1;
    const limit = 50;
    const filters = normalized ? { query: normalized } : {};
    const scope = `
        FROM history h
        LEFT JOIN keys k ON h.key_id = k.id
        LEFT JOIN employees e ON h.employee_id = e.id
        LEFT JOIN users u ON h.user_id = u.id
        ${normalized ? `WHERE instr(normalize_search(k.name), @query) > 0
            OR instr(normalize_search(k.room), @query) > 0
            OR instr(normalize_search(e.name), @query) > 0
            OR instr(normalize_search(COALESCE(h.username, u.username)), @query) > 0` : ''}
    `;
    const { total } = db.prepare(`SELECT COUNT(*) as total ${scope}`).get(filters) as { total: number };
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Number.isSafeInteger(requestedPage)
        ? Math.min(Math.max(1, requestedPage), totalPages)
        : 1;

    const history = db.prepare(`
        SELECT h.id, h.action, h.timestamp, COALESCE(h.username, u.username) as username,
               k.name as key_name, k.room, e.name as employee_name, e.entity_type
        ${scope}
        ORDER BY h.timestamp DESC, h.id DESC
        LIMIT @limit OFFSET @offset
    `).all({ ...filters, limit, offset: (page - 1) * limit }) as HistoryItem[];

    return <HistoryClient history={history} userRole={session.role} username={session.username} search={search} total={total} currentPage={page} totalPages={totalPages} />;
}
