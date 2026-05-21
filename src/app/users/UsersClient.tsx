'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

type User = { id: number; username: string; role: string; };

export default function UsersClient() {
    const [users, setUsers] = useState<User[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formUser, setFormUser] = useState('');
    const [formPass, setFormPass] = useState('');
    const [formRole, setFormRole] = useState('PORTEIRO');
    const [saving, setSaving] = useState(false);
    const [deleteModal, setDeleteModal] = useState<User | null>(null);
    const [resetModal, setResetModal] = useState<User | null>(null);
    const [resetPass, setResetPass] = useState('');

    useEffect(() => {
        fetch('/api/users').then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false); });
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formUser, password: formPass, role: formRole }) });
            const data = await res.json();
            if (res.ok) {
                setUsers(prev => [...prev, { id: data.id, username: formUser, role: formRole }]);
                toast.success(data.reactivated ? 'Usuário reativado!' : 'Usuário criado!');
                setShowForm(false); setFormUser(''); setFormPass(''); setFormRole('PORTEIRO');
            } else { toast.error(data.error || 'Erro ao criar usuário.'); }
        } catch { toast.error('Erro de conexão.'); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        try {
            const res = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteModal.id }) });
            const data = await res.json();
            if (res.ok) { setUsers(prev => prev.filter(u => u.id !== deleteModal.id)); toast.success('Usuário removido.'); }
            else { toast.error(data.error || 'Erro ao remover.'); }
        } catch { toast.error('Erro de conexão.'); }
        setDeleteModal(null);
    };

    const handleResetPass = async () => {
        if (!resetModal || !resetPass.trim()) return;
        try {
            const res = await fetch('/api/users/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: resetModal.id, newPassword: resetPass }) });
            const data = await res.json();
            if (res.ok) { toast.success('Senha redefinida!'); }
            else { toast.error(data.error || 'Erro.'); }
        } catch { toast.error('Erro de conexao.'); }
        setResetModal(null); setResetPass('');
    };

    const roleBadge = (role: string) => role === 'ADMIN' ? 'badge-admin' : role === 'PORTEIRO' ? 'badge-porteiro' : 'badge-user';
    const roleLabel = (role: string) => role === 'ADMIN' ? 'Admin' : role === 'PORTEIRO' ? 'Porteiro' : 'Usuário';

    return (
        <div className="page-wrapper">
            <Sidebar userRole="ADMIN" username="admin" isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Usuários</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content animate-fade">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Usuários do Sistema</h1>
                        <p className="page-subtitle">Gerencie os acessos ao sistema</p>
                    </div>
                    <button className="btn btn-gold" onClick={() => setShowForm(true)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Novo Usuário
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
                ) : (
                    <div className="table-wrapper card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Usuário</th>
                                    <th>Perfil</th>
                                    <th style={{ textAlign: 'right' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--navy-600), var(--navy-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-gold)', flexShrink: 0 }}>
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{u.username}</span>
                                            </div>
                                        </td>
                                        <td><span className={`badge ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span></td>
                                        <td>
                                            <div className="action-row">
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setResetModal(u); setResetPass(''); }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                    Senha
                                                </button>
                                                <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(u)}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                                                    Remover
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Novo Usuário</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Nome de Usuário *</label>
                                <input className="input" value={formUser} onChange={e => setFormUser(e.target.value)} required minLength={3} placeholder="mínimo 3 caracteres" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Senha *</label>
                                <input className="input" type="password" value={formPass} onChange={e => setFormPass(e.target.value)} required minLength={6} placeholder="mínimo 6 caracteres" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Perfil de Acesso</label>
                                <select className="input" value={formRole} onChange={e => setFormRole(e.target.value)}>
                                    <option value="PORTEIRO">Porteiro</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-gold" disabled={saving}>
                                    {saving ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Criar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {resetModal && (
                <div className="modal-overlay" onClick={() => setResetModal(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Redefinir Senha — {resetModal.username}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setResetModal(null)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="input-label">Nova Senha</label>
                            <input className="input" type="password" value={resetPass} onChange={e => setResetPass(e.target.value)} placeholder="mínimo 6 caracteres" minLength={6} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setResetModal(null)}>Cancelar</button>
                            <button className="btn btn-gold" onClick={handleResetPass} disabled={resetPass.length < 6}>Redefinir</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!deleteModal} title="Remover Usuário" message={`Remover o usuário "${deleteModal?.username}"? O acesso será revogado.`} confirmText="Remover" onConfirm={handleDelete} onCancel={() => setDeleteModal(null)} />
        </div>
    );
}
