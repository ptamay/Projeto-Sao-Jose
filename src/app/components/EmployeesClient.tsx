'use client';
import { useState, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';

interface Employee { id: number; name: string; role?: string; entity_type: 'person' | 'location'; }
interface Props { initialEmployees: Employee[]; userRole: string; username?: string; }

export default function EmployeesClient({ initialEmployees, userRole, username }: Props) {
    const [employees, setEmployees] = useState<Employee[]>(initialEmployees || []);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [showForm, setShowForm] = useState(false);
    const [editEmp, setEditEmp] = useState<Employee | null>(null);
    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formEntityType, setFormEntityType] = useState<'person' | 'location'>('person');
    const [loading, setLoading] = useState(false);
    const [deleteModal, setDeleteModal] = useState<Employee | null>(null);

    const isAdmin = ['ADMIN', 'PORTEIRO'].includes(userRole);
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Persistência do modo de visualização
    useEffect(() => {
        const saved = localStorage.getItem('employees-view') as 'grid' | 'list';
        if (saved) setViewMode(saved);
    }, []);

    const toggleView = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('employees-view', mode);
    };

    const filtered = useMemo(() => {
        const s = normalize(search);
        return employees.filter(e =>
            normalize(e.name).includes(s) ||
            normalize(e.role || '').includes(s)
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [employees, search]);

    const openNew = () => { setEditEmp(null); setFormName(''); setFormRole(''); setFormEntityType('person'); setShowForm(true); };
    const openEdit = (e: Employee) => { setEditEmp(e); setFormName(e.name); setFormRole(e.role || ''); setFormEntityType(e.entity_type || 'person'); setShowForm(true); };

    const handleSave = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!formName.trim()) return;
        setLoading(true);
        try {
            const method = editEmp ? 'PUT' : 'POST';
            const body = editEmp
                ? { id: editEmp.id, name: formName.trim(), role: formRole.trim(), entity_type: formEntityType }
                : { name: formName.trim(), role: formRole.trim(), entity_type: formEntityType };
            const res = await fetch('/api/employees', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) {
                if (editEmp) {
                    setEmployees(prev => prev.map(e => e.id === editEmp.id ? { ...e, name: formName.trim(), role: formRole.trim(), entity_type: formEntityType } : e));
                    toast.success('Cadastro atualizado!');
                } else {
                    setEmployees(prev => [...prev, { id: data.id, name: formName.trim(), role: formRole.trim(), entity_type: formEntityType }]);
                    toast.success('Cadastrado com sucesso!');
                }
                setShowForm(false);
            } else { toast.error(data.error || 'Erro ao salvar.'); }
        } catch { toast.error('Erro de conexão.'); }
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        try {
            const res = await fetch('/api/employees', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteModal.id }) });
            const data = await res.json();
            if (res.ok) {
                setEmployees(prev => prev.filter(e => e.id !== deleteModal.id));
                toast.success('Funcionário removido.');
            } else { toast.error(data.error || 'Erro ao remover.'); }
        } catch { toast.error('Erro de conexão.'); }
        setDeleteModal(null);
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="page-wrapper">
            <Sidebar userRole={userRole} username={username} isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Pessoas & Locais</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content animate-fade">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Pessoas & Locais</h1>
                        <p className="page-subtitle">Gerencie as pessoas ou os locais de destino dos itens</p>
                    </div>
                    {isAdmin && (
                        <button className="btn btn-gold" onClick={openNew}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Novo Cadastro
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ maxWidth: 300 }}>
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar por nome ou cargo..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className={`btn ${viewMode === 'list' ? 'btn-gold' : 'btn-ghost'} btn-sm`} onClick={() => toggleView('list')} title="Ver em Lista">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                        <button className={`btn ${viewMode === 'grid' ? 'btn-gold' : 'btn-ghost'} btn-sm`} onClick={() => toggleView('grid')} title="Ver em Grade">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </button>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.25rem' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} total</span>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 1rem' }}>
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p>Nenhum registro encontrado.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {filtered.map(emp => (
                            <div key={emp.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--navy-600), var(--navy-400))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: 'var(--text-gold)', flexShrink: 0, border: '2px solid var(--border)' }}>
                                    {emp.entity_type === 'location' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> : getInitials(emp.name)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{emp.role || 'Sem cargo definido'}</div>
                                </div>
                                {isAdmin && (
                                    <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                                        <button className="btn btn-ghost btn-icon btn-sm" title="Editar" onClick={() => openEdit(emp)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button className="btn btn-danger btn-icon btn-sm" title="Remover" onClick={() => setDeleteModal(emp)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Modo Lista */
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '70px 1fr 1fr 140px', 
                            padding: '1rem 2.5rem 1rem 1.5rem', 
                            background: 'var(--navy-900)', 
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: 'white',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            <div style={{ textAlign: 'center' }}>Avatar</div>
                            <div style={{ textAlign: 'left', paddingLeft: '1rem' }}>Nome Completo</div>
                            <div style={{ textAlign: 'left' }}>Cargo / Função</div>
                            <div style={{ textAlign: 'center' }}>Ações</div>
                        </div>

                        {filtered.map(emp => (
                            <div key={emp.id} style={{ 
                                display: 'grid', 
                                gridTemplateColumns: '70px 1fr 1fr 140px', 
                                padding: '0.75rem 2.5rem 0.75rem 1.5rem', 
                                borderBottom: '1px solid var(--border)',
                                alignItems: 'center',
                                transition: 'background 0.2s ease'
                            }} className="list-row-hover">
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--navy-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-gold)', border: '1px solid var(--border)' }}>
                                        {emp.entity_type === 'location' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> : getInitials(emp.name)}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'left', paddingLeft: '1rem' }}>
                                    {emp.name}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'left' }}>
                                    {emp.role || '-'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                    {isAdmin && (
                                        <>
                                            <button className="btn btn-ghost btn-sm" style={{ padding: '0.4rem 0.75rem' }} onClick={() => openEdit(emp)}>
                                                Editar
                                            </button>
                                            <button className="btn btn-danger btn-sm" style={{ padding: '0.4rem 0.75rem' }} onClick={() => setDeleteModal(emp)}>
                                                Remover
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editEmp ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Tipo</label>
                                <select className="input" value={formEntityType} onChange={e => setFormEntityType(e.target.value as any)}>
                                    <option value="person">Pessoa (Funcionário)</option>
                                    <option value="location">Local / Destino (Ex: Capela)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">{formEntityType === 'person' ? 'Nome Completo *' : 'Nome do Local *'}</label>
                                <input className="input" placeholder={formEntityType === 'person' ? 'Ex: João da Silva' : 'Ex: Capela Central'} value={formName} onChange={e => setFormName(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">{formEntityType === 'person' ? 'Cargo / Função' : 'Observação (Opcional)'}</label>
                                <input className="input" placeholder={formEntityType === 'person' ? 'Ex: Professor, Auxiliar...' : 'Ex: Deixado no balcão...'} value={formRole} onChange={e => setFormRole(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-gold" disabled={loading}>
                                    {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : (editEmp ? 'Salvar' : 'Cadastrar')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!deleteModal} title="Remover Funcionário" message={`Deseja remover "${deleteModal?.name}"?`} confirmText="Remover" onConfirm={handleDelete} onCancel={() => setDeleteModal(null)} />
        </div>
    );
}
