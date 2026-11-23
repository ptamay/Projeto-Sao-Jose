import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';
import DashboardClient from './components/DashboardClient';
import type { ItemUsage } from './components/DashboardClient';

function getData() {
    const keys = db.prepare(`
        SELECT k.*, e.name as employee_name, e.role as employee_role, e.entity_type as employee_type
        FROM keys k
        LEFT JOIN employees e ON k.employee_id = e.id
        WHERE k.active = 1
        ORDER BY k.name ASC
    `).all();
    const employees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY name ASC').all();
    
    const history = db.prepare(`
        SELECT key_id, employee_id, COUNT(*) as count 
        FROM history 
        WHERE key_id IS NOT NULL AND action IN ('withdraw', 'transfer')
        GROUP BY key_id, employee_id 
    `).all() as { key_id: number; employee_id: number | null; count: number }[];

    const usageByItem: Record<number, ItemUsage> = {};
    for (const row of history) {
        const entry = usageByItem[row.key_id] ??= { total: 0, destinations: {} };
        entry.total += row.count;
        if (row.employee_id !== null) entry.destinations[row.employee_id] = row.count;
    }

    return { keys, employees, usageByItem };
}

export default async function Home() {
    const session = (await cookies()).get('session');
    if (!session) redirect('/login');

    let sessionData;
    try {
        sessionData = await verifySession(session.value);
        if (!sessionData) throw new Error('Invalid session');
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(sessionData.id);
        if (!user) redirect('/login');
    } catch {
        redirect('/login');
    }

    const { keys, employees, usageByItem } = getData();

    return (
        <main>
            <DashboardClient
                initialKeys={keys as any}
                initialEmployees={employees as any}
                userRole={sessionData.role || 'USER'}
                userId={sessionData.id}
                username={sessionData.username}
                initialUsage={usageByItem}
            />
        </main>
    );
}
