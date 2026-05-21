'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

interface HistoryItem {
    id: number;
    action: string;
    timestamp: string;
    key_name: string;
    room?: string;
    employee_name?: string;
    username?: string;
}
interface Props {
    history: HistoryItem[];
    userRole: string;
    username?: string;
    currentPage: number;
    totalPages: number;
}

function formatDate(ts: string) {
    try {
        const d = new Date(ts);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
}

export default function HistoryClient({ history, userRole, username, currentPage, totalPages }: Props) {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [clearModal, setClearModal] = useState(false);
    const [search, setSearch] = useState('');

    const isAdmin = userRole === 'ADMIN';

    const filtered = history.filter(h =>
        (h.key_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.employee_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.room || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleClearHistory = async () => {
        try {
            const res = await fetch('/api/history/clear', { method: 'DELETE' });
            if (res.ok) { 
                toast.success('Histórico limpo.'); 
                router.refresh(); 
            }
            else { 
                const d = await res.json(); 
                toast.error(d.error || 'Erro ao limpar.'); 
            }
        } catch { 
            toast.error('Erro de conexão.'); 
        } finally {
            setClearModal(false);
        }
    };

    const goPage = (p: number) => router.push(`/history?page=${p}`);

    return (
        <div className="page-wrapper">
            <Sidebar userRole={userRole} username={username} isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Histórico</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content animate-fade">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Histórico de Movimentações</h1>
                        <p className="page-subtitle">Registro completo de retiradas e devoluções</p>
                    </div>
                    {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => setClearModal(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Limpar Histórico
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ maxWidth: 300 }}>
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar chave, funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Página {currentPage} de {totalPages}
                    </span>
                </div>

                <div className="table-wrapper card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Data / Hora</th>
                                <th>Ação</th>
                                <th>Chave</th>
                                <th>Funcionário</th>
                                <th>Operador</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Nenhum registro encontrado.</td></tr>
                            ) : filtered.map(h => (
                                <tr key={h.id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(h.timestamp)}</td>
                                    <td>
                                        <span className={`status-tag ${h.action === 'withdraw' ? 'status-inuse' : 'status-available'}`}>
                                            {h.action === 'withdraw' ? 'Retirada' : 'Devolução'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600 }}>{h.key_name || '-'}</span>
                                        {h.room && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({h.room})</span>}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{h.employee_name || '-'}</td>
                                    <td>
                                        <span style={{ fontSize: '0.8rem', background: 'var(--bg-elevated)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                            {h.username || '-'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="pagination">
                        <button onClick={() => goPage(currentPage - 1)} disabled={currentPage <= 1}>{'<'}</button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            const p = i + 1;
                            return <button key={p} className={currentPage === p ? 'active' : ''} onClick={() => goPage(p)}>{p}</button>;
                        })}
                        <button onClick={() => goPage(currentPage + 1)} disabled={currentPage >= totalPages}>{'>'}</button>
                    </div>
                )}
            </main>

            <ConfirmModal isOpen={clearModal} title="Limpar Histórico" message="Tem certeza? Todo o histórico de movimentações será apagado permanentemente." confirmText="Limpar" onConfirm={handleClearHistory} onCancel={() => setClearModal(false)} />
        </div>
    );
}
