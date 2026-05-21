'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

interface Log {
    id: number;
    username: string;
    action: string;
    target: string;
    details?: string;
    timestamp: string;
}

function formatDate(ts: string) {
    try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return ts; }
}

const actionColors: Record<string, string> = {
    CREATE: '#4ade80', UPDATE: '#60a5fa', DELETE: '#f87171', LOGIN: '#c084fc',
    LOGOUT: '#94a3b8', WITHDRAW: '#fb923c', RETURN: '#4ade80',
};
const getColor = (action: string) => {
    const key = Object.keys(actionColors).find(k => action.toUpperCase().includes(k));
    return key ? actionColors[key] : '#e0be68';
};

export default function LogsClient() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        loadLogs();
    }, [page, search]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/logs?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
            const d = await res.json();
            if (d.logs) {
                setLogs(d.logs);
                setTotalPages(d.totalPages || 1);
            } else {
                setLogs([]);
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            setLogs([]);
        }
        setLoading(false);
    };

    // Debounced search could be better, but for now simple input
    const handleSearch = (val: string) => {
        setSearch(val);
        setPage(1); // Reset to first page on search
    };

    return (
        <div className="page-wrapper">
            <Sidebar userRole="ADMIN" username="admin" isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Logs de Auditoria</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content animate-fade">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Logs de Auditoria</h1>
                        <p className="page-subtitle">Rastro completo de ações administrativas no sistema</p>
                    </div>
                    <div className="badge badge-admin" style={{ padding: '0.5rem 1rem', height: 'fit-content' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', marginRight: '0.5rem', boxShadow: '0 0 8px currentColor' }} />
                        Somente leitura
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                    <div className="search-bar" style={{ maxWidth: 360 }}>
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar usuário, ação ou alvo..." value={search} onChange={e => handleSearch(e.target.value)} />
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Página {page} de {totalPages}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><div className="spinner" style={{ width: 40, height: 40 }} /></div>
                ) : (
                    <>
                        <div className="table-wrapper card">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Data / Hora</th>
                                        <th>Usuário</th>
                                        <th style={{ textAlign: 'center' }}>Ação</th>
                                        <th>Alvo</th>
                                        <th>Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '5rem' }}>Nenhum log encontrado para esta busca.</td></tr>
                                    ) : logs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(log.timestamp)}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--navy-700)', color: 'var(--gold-400)', border: '1px solid var(--gold-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                        {log.username?.[0]?.toUpperCase() || 'U'}
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{log.username || '-'}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center', 
                                                    gap: '0.375rem', 
                                                    fontSize: '0.65rem', 
                                                    fontWeight: 800, 
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    padding: '0.3rem 0.75rem', 
                                                    borderRadius: '999px', 
                                                    background: `${getColor(log.action)}12`, 
                                                    color: getColor(log.action),
                                                    border: `1px solid ${getColor(log.action)}25`
                                                }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: getColor(log.action), boxShadow: `0 0 6px ${getColor(log.action)}` }} />
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{log.target || '-'}</td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                                                {log.details || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                                ))}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

