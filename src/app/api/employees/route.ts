import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { logAction } from '@/lib/logger';
import { verifySession } from '@/lib/session';
import { EmployeeSchema } from '@/lib/schemas';

async function getUser() {
    const sessionCookie = (await cookies()).get('session');
    if (!sessionCookie) return null;
    try {
        return await verifySession(sessionCookie.value);
    } catch {
        return null;
    }
}

// Get all employees
export async function GET() {
    try {
        const user = await getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const employees = db.prepare('SELECT * FROM employees WHERE active = 1').all();
        return NextResponse.json(employees);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }
}

// Create a new employee
export async function POST(request: Request) {
    try {
        const user = await getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && user.role !== 'PORTEIRO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const parseResult = EmployeeSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Inválido' }, { status: 400 });
        }
        
        const { name, role, entity_type } = parseResult.data;

        const stmt = db.prepare('INSERT INTO employees (name, role, entity_type) VALUES (?, ?, ?)');
        const info = stmt.run(name, role || '', entity_type);

        if (user) {
            logAction(user.id, user.username, 'CREATE_EMPLOYEE', name, `Role: ${role || 'None'}`);
        }

        return NextResponse.json({ id: info.lastInsertRowid, name, role });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}

// Update employee
export async function PUT(request: Request) {
    try {
        const user = await getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && user.role !== 'PORTEIRO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const parseResult = EmployeeSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: parseResult.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 });
        }
        if (!parseResult.data.id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }
        
        const { id, name, role, entity_type } = parseResult.data;

        const currentEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as any;

        const stmt = db.prepare('UPDATE employees SET name = ?, role = ?, entity_type = ? WHERE id = ?');
        const info = stmt.run(name, role || '', entity_type, id);

        if (info.changes === 0) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        if (user && currentEmployee) {
            const details = `Changed from: ${currentEmployee.name} (${currentEmployee.role}) to ${name} (${role})`;
            logAction(user.id, user.username, 'UPDATE_EMPLOYEE', name, details);
        }

        return NextResponse.json({ success: true, id, name, role });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
    }
}

// Delete employee
export async function DELETE(request: Request) {
    try {
        const user = await getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && user.role !== 'PORTEIRO') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const body = await request.json();
        const { id } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const employee = db.prepare('SELECT name, role FROM employees WHERE id = ?').get(id) as any;

        // Check if employee has keys in use (now checking keys table directly)
        const activeKey = db.prepare('SELECT id FROM keys WHERE employee_id = ?').get(id);

        if (activeKey) {
            return NextResponse.json({ error: 'Não é possível apagar: Funcionário possui chaves em uso.' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE employees SET active = 0 WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes === 0) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        if (user && employee) {
            logAction(user.id, user.username, 'DELETE_EMPLOYEE', employee.name, `Deleted employee ${employee.name} - ${employee.role}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete employee error:', error);
        return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
    }
}
