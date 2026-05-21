import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';
import DashboardClient from './components/DashboardClient';

function getData() {
    const keys = db.prepare(`
        SELECT k.*, e.name as employee_name, e.role as employee_role
        FROM keys k
        LEFT JOIN employees e ON k.employee_id = e.id
        WHERE k.active = 1
        ORDER BY k.name ASC
    `).all();
    const employees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY name ASC').all();
    return { keys, employees };
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

    const { keys, employees } = getData();

    return (
        <main>
            <DashboardClient
                initialKeys={keys as any}
                initialEmployees={employees as any}
                userRole={sessionData.role || 'USER'}
                userId={sessionData.id}
                username={sessionData.username}
            />
        </main>
    );
}
