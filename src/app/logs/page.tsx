import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/session';
import LogsClient from './LogsClient';

export default async function LogsPage() {
    const session = (await cookies()).get('session');

    if (!session) {
        redirect('/login');
    }

    try {
        const sessionData = await verifySession(session.value);
        if (!sessionData || sessionData.role !== 'ADMIN') {
            redirect('/');
        }
    } catch {
        redirect('/login');
    }

    return <LogsClient />;
}
