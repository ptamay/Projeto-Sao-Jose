import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';
import EmployeesClient from '../components/EmployeesClient';

export default async function EmployeesPage() {
    const sessionCookie = (await cookies()).get('session');
    if (!sessionCookie) redirect('/login');

    let session;
    try {
        session = await verifySession(sessionCookie.value);
        if (!session) throw new Error();
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(session.id);
        if (!user) redirect('/login');
    } catch { redirect('/login'); }

    const employees = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY name ASC').all();

    return (
        <main>
            <EmployeesClient initialEmployees={employees as any} userRole={session.role} username={session.username} />
        </main>
    );
}
