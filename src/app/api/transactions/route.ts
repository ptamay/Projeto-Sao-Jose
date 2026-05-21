import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { TransactionSchema } from '@/lib/schemas';

export async function POST(request: Request) {
    try {
        const sessionCookie = (await cookies()).get('session');
        if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const session = await verifySession(sessionCookie.value);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const parseResult = TransactionSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 });
        }
        
        const { action, key_id: keyId, employee_id: employeeId, observation } = parseResult.data;

        const key = db.prepare('SELECT * FROM keys WHERE id = ?').get(keyId) as any;
        if (!key) {
            return NextResponse.json({ error: 'Key not found' }, { status: 404 });
        }

        if (key.active === 0) {
            return NextResponse.json({ error: 'Esta chave foi desativada e não pode ser usada.' }, { status: 400 });
        }

        if (action === 'withdraw') {
            if (!employeeId) return NextResponse.json({ error: 'Employee required for withdrawal' }, { status: 400 });
            
            const employee = db.prepare('SELECT active FROM employees WHERE id = ?').get(employeeId) as any;
            if (!employee || employee.active === 0) {
                return NextResponse.json({ error: 'Este funcionário foi desativado e não pode retirar chaves.' }, { status: 400 });
            }

            if (key.status !== 'available') return NextResponse.json({ error: 'Key is already in use' }, { status: 400 });

            // Transaction
            const trans = db.transaction(() => {
                db.prepare("UPDATE keys SET status = 'in_use', employee_id = ?, observation = ? WHERE id = ?").run(employeeId, observation || null, keyId);
                db.prepare("INSERT INTO history (key_id, employee_id, action, observation, timestamp, user_id, username) VALUES (?, ?, 'withdraw', ?, ?, ?, ?)").run(keyId, employeeId, observation || null, new Date().toISOString(), session.id, session.username);
            });
            trans();

        } else if (action === 'return') {
            if (key.status !== 'in_use') return NextResponse.json({ error: 'Key is not in use' }, { status: 400 });

            const trans = db.transaction(() => {
                // Determine who had it from keys table or history? 
                // Since we now store employee_id on keys, use that or the passed one.
                // For history log consistency, if employeeId is passed use it, otherwise use the one on the key?
                // The prompt for 'return' usually doesn't ask for employee, just 'return key'.
                // So let's use the current holder from the key if available.

                const currentHolder = key.employee_id;

                db.prepare("UPDATE keys SET status = 'available', employee_id = NULL, observation = NULL WHERE id = ?").run(keyId);
                db.prepare("INSERT INTO history (key_id, employee_id, action, timestamp, user_id, username) VALUES (?, ?, 'return', ?, ?, ?)").run(keyId, employeeId || currentHolder || null, new Date().toISOString(), session.id, session.username);
            });
            trans();

        } else if (action === 'transfer') {
            if (key.status !== 'in_use') return NextResponse.json({ error: 'Key must be in use to transfer' }, { status: 400 });
            if (!employeeId) return NextResponse.json({ error: 'New employee required for transfer' }, { status: 400 });
            
            const employee = db.prepare('SELECT active FROM employees WHERE id = ?').get(employeeId) as any;
            if (!employee || employee.active === 0) {
                return NextResponse.json({ error: 'Este funcionário foi desativado e não pode receber chaves.' }, { status: 400 });
            }

            const trans = db.transaction(() => {
                db.prepare("UPDATE keys SET employee_id = ?, observation = ? WHERE id = ?").run(employeeId, observation || key.observation || null, keyId);
                db.prepare("INSERT INTO history (key_id, employee_id, action, observation, timestamp, user_id, username) VALUES (?, ?, 'transfer', ?, ?, ?, ?)").run(keyId, employeeId, observation || key.observation || null, new Date().toISOString(), session.id, session.username);
            });
            trans();

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transaction error:', error);
        return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
    }
}
