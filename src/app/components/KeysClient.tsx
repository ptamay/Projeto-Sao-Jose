'use client';
import { useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import ConfirmModal from './ConfirmModal';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Key { id: number; name: string; room?: string; status: string; }
interface Props { initialKeys: Key[]; userRole: string; username?: string; }

export default function KeysClient({ initialKeys, userRole, username }: Props) {
    const [keys, setKeys] = useState<Key[]>(initialKeys || []);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editKey, setEditKey] = useState<Key | null>(null);
    const [formName, setFormName] = useState('');
    const [formRoom, setFormRoom] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleteModal, setDeleteModal] = useState<Key | null>(null);

    const isAdmin = ['ADMIN', 'PORTEIRO'].includes(userRole);
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const filtered = useMemo(() => {
        const s = normalize(search);
        return keys
            .filter(k =>
                normalize(k.name).includes(s) ||
                normalize(k.room || '').includes(s)
            )
            .sort((a, b) => {
                if (a.status === 'in_use' && b.status === 'available') return -1;
                if (a.status === 'available' && b.status === 'in_use') return 1;
                return a.name.localeCompare(b.name);
            });
    }, [keys, search]);

    const openNew = () => { setEditKey(null); setFormName(''); setFormRoom(''); setShowForm(true); };
    const openEdit = (k: Key) => { setEditKey(k); setFormName(k.name); setFormRoom(k.room || ''); setShowForm(true); };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) return;
        setLoading(true);
        try {
            const method = editKey ? 'PUT' : 'POST';
            const body = editKey
                ? { id: editKey.id, name: formName.trim(), room: formRoom.trim() }
                : { name: formName.trim(), room: formRoom.trim() };
            const res = await fetch('/api/keys', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) {
                if (editKey) {
                    setKeys(prev => prev.map(k => k.id === editKey.id ? { ...k, name: formName.trim(), room: formRoom.trim() } : k));
                    toast.success('Chave atualizada!');
                } else {
                    setKeys(prev => [...prev, { id: data.id, name: formName.trim(), room: formRoom.trim(), status: 'available' }]);
                    toast.success('Chave cadastrada!');
                }
                setShowForm(false);
            } else {
                toast.error(data.error || 'Erro ao salvar.');
            }
        } catch { toast.error('Erro de conexão.'); }
        finally { setLoading(false); }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        try {
            const res = await fetch('/api/keys', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteModal.id }) });
            const data = await res.json();
            if (res.ok) {
                setKeys(prev => prev.filter(k => k.id !== deleteModal.id));
                toast.success('Chave removida.');
            } else { toast.error(data.error || 'Erro ao remover.'); }
        } catch { toast.error('Erro de conexão.'); }
        setDeleteModal(null);
    };

    return (
        <div className="page-wrapper">
            <Sidebar userRole={userRole} username={username} isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Chaves</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content animate-fade">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Chaves</h1>
                        <p className="page-subtitle">Gerencie o cadastro de chaves da instituição</p>
                    </div>
                    {isAdmin && (
                        <button className="btn btn-gold" onClick={openNew}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nova Chave
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ maxWidth: 300 }}>
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar chave ou sala..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filtered.length} chave{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '130px 1fr 1fr 180px', 
                        padding: '1rem 2.5rem 1rem 1rem', 
                        background: 'var(--navy-900)', 
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        color: 'white',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}>
                        <div style={{ textAlign: 'center' }}>Status</div>
                        <div style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>Chave</div>
                        <div style={{ textAlign: 'left' }}>Local / Sala</div>
                        <div style={{ textAlign: 'center' }}>Ações</div>
                    </div>

                    {filtered.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Nenhuma chave encontrada.
                        </div>
                    ) : filtered.map(k => (
                        <div key={k.id} style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '130px 1fr 1fr 180px', 
                            padding: '1rem 2.5rem 1rem 1rem', 
                            borderBottom: '1px solid var(--border)',
                            alignItems: 'center',
                            transition: 'background 0.2s ease'
                        }} className="list-row-hover">
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <span className={`status-tag ${k.status === 'available' ? 'status-available' : 'status-inuse'}`} style={{ fontSize: '0.65rem' }}>
                                    {k.status === 'available' ? 'Disponível' : 'Em Uso'}
                                </span>
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left', paddingLeft: '1.5rem' }}>
                                {k.name}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'left' }}>
                                {k.room || '-'}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(k)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Editar
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(k)} disabled={k.status === 'in_use'}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                    Remover
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editKey ? 'Editar Chave' : 'Nova Chave'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Nome da Chave *</label>
                                <input className="input" placeholder="Ex: Chave da Secretaria" value={formName} onChange={e => setFormName(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Sala / Local</label>
                                <input className="input" placeholder="Ex: Sala 101, Laboratório..." value={formRoom} onChange={e => setFormRoom(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-gold" disabled={loading}>
                                    {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : (editKey ? 'Salvar Alterações' : 'Cadastrar Chave')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!deleteModal}
                title="Remover Chave"
                message={`Deseja remover a chave "${deleteModal?.name}"? Esta ação não pode ser desfeita.`}
                confirmText="Remover"
                onConfirm={handleDelete}
                onCancel={() => setDeleteModal(null)}
            />
        </div>
    );
}
