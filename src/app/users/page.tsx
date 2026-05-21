import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import UsersClient from './UsersClient';

export default async function UsersPage() {
    const sessionCookie = (await cookies()).get('session');

    if (!sessionCookie) {
        redirect('/login');
    }

    try {
        const session = await verifySession(sessionCookie.value);
        if (!session || session.role !== 'ADMIN') {
            redirect('/');
        }
    } catch {
        redirect('/login');
    }

    return <UsersClient />;
}
