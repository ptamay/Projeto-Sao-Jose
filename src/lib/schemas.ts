import { z } from 'zod';

// Users
export const UserSchema = z.object({
    username: z.string().min(3, "O usuário deve ter pelo menos 3 caracteres.").max(50, "Máximo de 50 caracteres."),
    password: z.string().min(6, "A senha deve conter no mínimo 6 caracteres.").max(128),
    role: z.enum(['ADMIN', 'PORTEIRO', 'USER']).default('PORTEIRO')
});

export const ChangePasswordSchema = z.object({
    userId: z.number().int().positive(),
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, "A nova senha deve ter no mínimo 6 caracteres.")
});

export const ChangeRoleSchema = z.object({
    targetUserId: z.number().int().positive(),
    newRole: z.enum(['ADMIN', 'PORTEIRO', 'USER'])
});

// Keys
export const KeySchema = z.object({
    id: z.number().int().positive().optional(),
    name: z.string().min(2, "Nome da chave deve ter no mínimo 2 caracteres."),
    room: z.string().optional()
});

// Employees
export const EmployeeSchema = z.object({
    id: z.number().int().positive().optional(),
    name: z.string().min(2, "Nome do funcionário muito curto."),
    role: z.string().optional()
});

// Transactions (History Actions)
export const TransactionSchema = z.object({
    action: z.enum(['withdraw', 'return', 'transfer']),
    key_id: z.number().int().positive("ID da chave inválido."),
    employee_id: z.number().int().positive("ID do funcionário inválido.").nullable().optional(),
    observation: z.string().optional()
});

// Settings
export const SettingsSchema = z.object({
    time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Formato de hora inválido (HH:MM).").optional(),
    backupTime: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Formato de hora inválido para backup (HH:MM).").optional(),
    backupCount: z.number().int().min(1, "O número de backups deve ser pelo menos 1.").max(50, "Máximo de 50 backups.").optional()
});
