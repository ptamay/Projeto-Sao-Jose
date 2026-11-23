'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

export interface HistoryItem {
    id: number;
    action: string;
    timestamp: string;
    key_name: string | null;
    room: string | null;
    employee_name: string | null;
    entity_type: 'person' | 'location' | null;
    username: string | null;
}
interface Props {
    history: HistoryItem[];
    userRole: string;
    username?: string;
    search: string;
    total: number;
    currentPage: number;
    totalPages: number;
}

function formatDate(ts: string) {
    try {
        const d = new Date(ts);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
}

export default function HistoryClient({ history, userRole, username, search, total, currentPage, totalPages }: Props) {
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [clearModal, setClearModal] = useState(false);

    const isAdmin = userRole === 'ADMIN';

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

    const goPage = (p: number, query = search) => {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (p > 1) params.set('page', String(p));
        router.push(params.size ? `/history?${params}` : '/history');
    };

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
                        <p className="page-subtitle">Retiradas, transferências e devoluções</p>
                    </div>
                    {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => setClearModal(true)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Limpar Histórico
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <form role="search" aria-label="Histórico de movimentações" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: '1 1 24rem' }}
                        onSubmit={event => {
                            event.preventDefault();
                            const query = new FormData(event.currentTarget).get('q');
                            goPage(1, typeof query === 'string' ? query.trim() : '');
                        }}
                    >
                        <input key={search} className="input" type="search" name="q" defaultValue={search}
                            aria-label="Buscar no histórico" placeholder="Item, pessoa, local ou operador"
                            style={{ flex: '1 1 13rem', minWidth: 0 }}
                        />
                        <button type="submit" className="btn btn-gold btn-sm">Buscar</button>
                        {search && <button type="button" className="btn btn-ghost btn-sm" onClick={() => goPage(1, '')}>Limpar busca</button>}
                    </form>
                    <span role="status" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {total} {total === 1 ? 'registro' : 'registros'} · Página {currentPage} de {totalPages}
                    </span>
                </div>

                <div className="table-wrapper card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Data / Hora</th>
                                <th>Ação</th>
                                <th>Item</th>
                                <th>Pessoa ou local</th>
                                <th>Operador</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                                    {search ? 'Nenhum registro corresponde à busca.' : 'Nenhuma movimentação registrada.'}
                                </td></tr>
                            ) : history.map(h => (
                                <tr key={h.id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(h.timestamp)}</td>
                                    <td>
                                        <span className={`status-tag ${
                                            h.action === 'withdraw' ? 'status-inuse' :
                                            h.action === 'transfer' ? 'status-transfer' :
                                            'status-available'
                                        }`}>
                                            {h.action === 'withdraw' ? 'Retirada' :
                                             h.action === 'transfer' ? 'Transferência' :
                                             'Devolução'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600 }}>{h.key_name || '-'}</span>
                                        {h.room && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({h.room})</span>}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>
                                        {h.employee_name || '—'}
                                        {h.employee_name && h.entity_type === 'location' && <small> · Local</small>}
                                    </td>
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
                    <nav className="pagination" aria-label="Páginas do histórico">
                        <button aria-label="Página anterior" onClick={() => goPage(currentPage - 1)} disabled={currentPage <= 1}>{'<'}</button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4)) + i;
                            return <button key={p} className={currentPage === p ? 'active' : ''} aria-current={currentPage === p ? 'page' : undefined} aria-label={`Página ${p}`} onClick={() => goPage(p)}>{p}</button>;
                        })}
                        <button aria-label="Próxima página" onClick={() => goPage(currentPage + 1)} disabled={currentPage >= totalPages}>{'>'}</button>
                    </nav>
                )}
            </main>

            <ConfirmModal isOpen={clearModal} title="Limpar Histórico" message="Tem certeza? Todo o histórico de movimentações será apagado permanentemente." confirmText="Limpar" onConfirm={handleClearHistory} onCancel={() => setClearModal(false)} />
        </div>
    );
}
