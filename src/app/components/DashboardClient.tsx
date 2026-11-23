'use client';
import { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import Sidebar from './Sidebar';
import PortariaPicker from './PortariaPicker';
import ItemStatusBadge from './ItemStatusBadge';
import type { ItemStatus } from './ItemStatusBadge';
import { normalizeSearch } from '@/lib/search';
import toast from 'react-hot-toast';

interface Key {
    id: number;
    name: string;
    room?: string;
    status: ItemStatus;
    employee_id?: number;
    employee_name?: string;
    employee_role?: string;
    employee_type?: 'person' | 'location';
    item_type: 'key' | 'remote' | 'equipment';
}

interface Employee {
    id: number;
    name: string;
    role?: string;
    entity_type: 'person' | 'location';
}

export interface ItemUsage {
    total: number;
    destinations: Record<number, number>;
}

interface Props {
    initialKeys: Key[];
    initialEmployees: Employee[];
    userRole: string;
    userId: number;
    username?: string;
    initialUsage: Record<number, ItemUsage>;
}

type Action = 'withdraw' | 'return' | 'transfer';
type View = 'grid' | 'list';

const actionLabels = { withdraw: 'Retirar', return: 'Devolver', transfer: 'Transferir' };
const actionMessages = { withdraw: 'Retirada registrada.', return: 'Devolução registrada.', transfer: 'Transferência registrada.' };
const itemLabels = { key: 'Chave', remote: 'Controle', equipment: 'Equipamento' };
const itemSearchText = (item: Key) => [item.name, item.room, item.employee_name, itemLabels[item.item_type]].join(' ');
const viewEvent = 'portaria-view-change';
const getView = (): View => localStorage.getItem('dashboard-view') === 'grid' ? 'grid' : 'list';
const getServerView = (): View => 'list';

function subscribeView(callback: () => void) {
    window.addEventListener(viewEvent, callback);
    window.addEventListener('storage', callback);
    return () => {
        window.removeEventListener(viewEvent, callback);
        window.removeEventListener('storage', callback);
    };
}

function Holder({ item, showInitial = true }: { item: Key; showInitial?: boolean }) {
    const isLocation = item.employee_type === 'location';
    const name = item.employee_name?.trim();
    const initial = showInitial && !isLocation && name
        ? Array.from(name.normalize('NFC'))[0].toLocaleUpperCase('pt-BR')
        : '';

    return (
        <div className="portaria-holder" data-with-initial={!!initial || undefined}>
            {initial && <span className="portaria-holder-initial" aria-hidden="true">{initial}</span>}
            <div className="portaria-holder-copy">
                <small>{isLocation ? 'Local atual' : 'Posse atual'}</small>
                <strong>{name || 'Sem registro'}</strong>
                {!isLocation && item.employee_role && <small>{item.employee_role}</small>}
            </div>
        </div>
    );
}

export default function DashboardClient({ initialKeys, initialEmployees, userRole, username, initialUsage }: Props) {
    const [keys, setKeys] = useState<Key[]>(initialKeys || []);
    const [usage, setUsage] = useState(initialUsage);
    const employees = initialEmployees;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'available' | 'in_use'>('all');
    const viewMode = useSyncExternalStore(subscribeView, getView, getServerView);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Record<number, number>>({});
    
    const sortEmployeesByFrequency = (employeeList: Employee[], keyId: number) => {
        const counts = usage[keyId]?.destinations;
        return [...employeeList].sort((a, b) =>
            (counts?.[b.id] ?? 0) - (counts?.[a.id] ?? 0) || a.name.localeCompare(b.name, 'pt-BR')
        );
    };

    const [quickSelection, setQuickSelection] = useState<{ itemId: number; chooseDestination: boolean }>();
    const quickItem = keys.find(item => item.id === quickSelection?.itemId);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const itemInputRef = useRef<HTMLInputElement>(null);
    const destinationInputRef = useRef<HTMLInputElement>(null);
    const [confirmation, setConfirmation] = useState<{
        keyId: number;
        action: Action;
        destinationId?: number;
        observation: string;
        fromQuick: boolean;
        focusConfirm: boolean;
    } | null>(null);
    const confirmingItem = keys.find(item => item.id === confirmation?.keyId);
    const confirmationOpen = confirmation !== null;
    const showDestination = quickSelection?.chooseDestination && confirmation?.action !== 'return';

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (confirmationOpen && !dialog.open) {
            dialog.showModal();
            dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
        } else if (!confirmationOpen && dialog.open) {
            dialog.close();
            const previous = triggerRef.current;
            const usable = previous?.isConnected && !previous.matches(':disabled');
            const fallback = itemInputRef.current;
            (usable ? previous : fallback)?.focus();
        }
    }, [confirmationOpen]);

    useEffect(() => {
        function focusItemSearch(event: KeyboardEvent) {
            const target = event.target;
            if (event.key !== '/' || event.defaultPrevented || event.isComposing || event.repeat ||
                event.ctrlKey || event.metaKey || event.altKey || confirmationOpen ||
                (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]')))) return;

            event.preventDefault();
            itemInputRef.current?.focus();
            itemInputRef.current?.select();
        }

        window.addEventListener('keydown', focusItemSearch);
        return () => window.removeEventListener('keydown', focusItemSearch);
    }, [confirmationOpen]);

    function pickItem(id?: number, viaKeyboard = false) {
        const item = keys.find(key => key.id === id);
        if (!item) {
            setQuickSelection(undefined);
            return;
        }
        setSearch('');
        if (viaKeyboard && item.status === 'in_use') {
            openQuickReturn(item.id);
            return;
        }
        setQuickSelection({ itemId: item.id, chooseDestination: true });
        requestAnimationFrame(() => destinationInputRef.current?.focus());
    }

    function requestTransaction(keyId: number, action: Action, destinationId?: number,
        { fromQuick = false, focusConfirm = false } = {}) {
        const item = keys.find(key => key.id === keyId);
        if (!item) return;
        const targetId = destinationId ?? (action === 'withdraw' ? selectedEmployee[keyId] : undefined);
        if (action === 'withdraw' && !targetId) {
            toast.error('Selecione uma pessoa ou um local de destino.');
            return;
        }
        triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setConfirmation({ keyId, action, destinationId: targetId, observation: '', fromQuick, focusConfirm });
    }

    function pickQuickDestination(id?: number, viaKeyboard = false) {
        if (!quickItem || id === undefined) return;
        const action = quickItem.status === 'available' ? 'withdraw' : 'transfer';
        requestTransaction(quickItem.id, action, id, { fromQuick: true, focusConfirm: viaKeyboard });
    }

    function openQuickReturn(itemId: number) {
        setQuickSelection({ itemId, chooseDestination: false });
        requestTransaction(itemId, 'return', undefined, { fromQuick: true, focusConfirm: true });
    }

    async function confirmAction() {
        if (!confirmation || actionLoading !== null) return;
        const { keyId, action, destinationId, observation, fromQuick } = confirmation;
        if (action !== 'return' && !destinationId) return;

        setActionLoading(keyId);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, key_id: keyId, employee_id: destinationId ?? null, observation }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Erro na operação.');
                return;
            }

            const destination = employees.find(employee => employee.id === destinationId);
            setKeys(previous => previous.map(item => item.id !== keyId ? item : {
                ...item,
                status: action === 'return' ? 'available' : 'in_use',
                employee_id: destination?.id,
                employee_name: destination?.name,
                employee_role: destination?.role,
                employee_type: destination?.entity_type,
            }));
            if (action !== 'return' && destinationId !== undefined) {
                setUsage(previous => {
                    const current = previous[keyId];
                    return { ...previous, [keyId]: {
                        total: (current?.total ?? 0) + 1,
                        destinations: {
                            ...current?.destinations,
                            [destinationId]: (current?.destinations[destinationId] ?? 0) + 1,
                        },
                    } };
                });
                setSelectedEmployee(previous => {
                    const updated = { ...previous };
                    delete updated[keyId];
                    return updated;
                });
            }
            if (fromQuick) {
                setQuickSelection(undefined);
                triggerRef.current = itemInputRef.current;
            }
            setConfirmation(null);
            toast.success(actionMessages[action]);
        } catch {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setActionLoading(null);
        }
    }

    function toggleView(mode: View) {
        localStorage.setItem('dashboard-view', mode);
        window.dispatchEvent(new Event(viewEvent));
    }

    const stats = useMemo(() => ({
        available: keys.filter(k => k.status === 'available').length,
        inUse: keys.filter(k => k.status === 'in_use').length,
    }), [keys]);

    const filtered = useMemo(() => {
        const s = normalizeSearch(search);
        return keys
            .filter(k => {
                const matchSearch = normalizeSearch(itemSearchText(k)).includes(s);
                const matchFilter = filter === 'all' || k.status === filter;
                return matchSearch && matchFilter;
            })
            .sort((a, b) => {
                if (a.status === 'in_use' && b.status === 'available') return -1;
                if (a.status === 'available' && b.status === 'in_use') return 1;
                return a.name.localeCompare(b.name);
            });
    }, [keys, search, filter]);

    return (
        <div className="page-wrapper">
            <Sidebar userRole={userRole} username={username} isOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

            {/* Mobile topbar */}
            <div className="mobile-topbar">
                <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-gold)' }}>Dashboard</span>
                <div style={{ width: 36 }} />
            </div>

            <main className="main-content portaria-main">
                {/* 1. Header with Integrated Stats */}
                <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Controle Integrado de Portaria</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Colégio São José - Sistema Administrativo</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disponíveis</span>
                            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--status-available-text)' }}>{stats.available}</span>
                        </div>
                        <div style={{ background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Em Uso</span>
                            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--status-inuse-text)' }}>{stats.inUse}</span>
                        </div>
                    </div>
                </header>

                <section className="portaria-control" aria-labelledby="portaria-control-title">
                    <div className="portaria-control-header">
                        <h2 id="portaria-control-title">Movimentar um item</h2>
                        <p>Busque pelo item, pelo local ou por quem está com ele</p>
                    </div>
                    <div className="portaria-quick" data-with-destination={showDestination || undefined}>
                        <PortariaPicker
                            label="Buscar ou movimentar item"
                            placeholder="Nome do item, descrição, pessoa ou local"
                            searchShortcut
                            inputRef={itemInputRef}
                            options={[...filtered].sort((a, b) =>
                                Number(b.status === 'in_use') - Number(a.status === 'in_use') ||
                                (usage[b.id]?.total ?? 0) - (usage[a.id]?.total ?? 0) ||
                                a.name.localeCompare(b.name, 'pt-BR')
                            ).map(item => ({
                                id: item.id,
                                name: item.name,
                                searchText: itemSearchText(item),
                                details: [itemLabels[item.item_type], item.employee_name].filter(Boolean).join(' · '),
                                status: item.status,
                            }))}
                            selected={quickItem}
                            onSelect={pickItem}
                            onDefaultEnter={quickItem?.status === 'in_use' ? () => openQuickReturn(quickItem.id) : undefined}
                            queryValue={search}
                            onQueryChange={setSearch}
                        />
                        {quickItem && showDestination && (
                            <PortariaPicker
                                key={quickItem.id}
                                label={quickItem.status === 'available' ? 'Destino da retirada' : 'Novo destino'}
                                placeholder="Pessoa ou local de destino"
                                inputRef={destinationInputRef}
                                options={sortEmployeesByFrequency(employees, quickItem.id).map(employee => ({
                                    ...employee,
                                    details: employee.entity_type === 'location' ? 'Local' : 'Pessoa',
                                }))}
                                onSelect={pickQuickDestination}
                                onDefaultEnter={quickItem.status === 'in_use' ? () => openQuickReturn(quickItem.id) : undefined}
                            />
                        )}
                    </div>
                </section>

                {/* 3. Filters & Mode Toggle Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                    {(['all','available','in_use'] as const).map(f => (
                        <button 
                            key={f} 
                            className={`btn ${filter === f ? 'btn-gold' : 'btn-ghost'} btn-sm`} 
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'Todos' : f === 'available' ? 'Disponíveis' : 'Em Uso'}
                        </button>
                    ))}

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className={`btn ${viewMode === 'list' ? 'btn-gold' : 'btn-ghost'} btn-sm`} onClick={() => toggleView('list')} title="Ver em Lista">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                        <button className={`btn ${viewMode === 'grid' ? 'btn-gold' : 'btn-ghost'} btn-sm`} onClick={() => toggleView('grid')} title="Ver em Grade">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 1rem', opacity: 0.3 }}>
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                        </svg>
                        <p>Nenhum item encontrado.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
                        {filtered.map(key => (
                            <div key={key.id} className={`key-card ${key.status === 'in_use' ? 'inuse' : 'available'}`}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
                                    <div style={{ flex: 1 }} className="key-card-header-content">
                                        <button type="button" className="key-card-title portaria-item-button" onClick={() => pickItem(key.id)}>
                                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                {key.item_type === 'remote' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><circle cx="12" cy="18" r="1"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="14"/></svg> : key.item_type === 'equipment' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
                                            </span>
                                            {key.name}
                                        </button>
                                        {key.room && <div className="key-card-room">{key.room}</div>}
                                    </div>
                                    <ItemStatusBadge status={key.status} />
                                </div>

                                <div className="key-card-dynamic-area">
                                    {key.status === 'in_use' ? (
                                        <Holder item={key} />
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                                            <select
                                                className="input"
                                                aria-label={'Destino de ' + key.name}
                                                style={{ flex: 1, fontSize: '0.8125rem', height: '38px', padding: '0 2rem 0 0.75rem' }}
                                                value={selectedEmployee[key.id] || ''}
                                                onChange={e => setSelectedEmployee(prev => ({ ...prev, [key.id]: Number(e.target.value) }))}
                                            >
                                                <option value="">Selecione o destino</option>
                                                <optgroup label="Pessoas">
                                                    {sortEmployeesByFrequency(employees, key.id).filter(e => e.entity_type === 'person' || !e.entity_type).map(emp => (
                                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Locais / Destinos">
                                                    {sortEmployeesByFrequency(employees, key.id).filter(e => e.entity_type === 'location').map(emp => (
                                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                            <button
                                                className="btn btn-gold btn-sm"
                                                style={{ height: '38px', padding: '0 1.25rem' }}
                                                disabled={actionLoading === key.id || !selectedEmployee[key.id]}
                                                onClick={() => requestTransaction(key.id, 'withdraw')}
                                            >
                                                {actionLoading === key.id ? <div className="spinner" style={{ width: 14, height: 14 }} /> : 'Retirar'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                                    {key.status === 'in_use' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                            <button
                                                className="btn btn-navy btn-sm"
                                                disabled={actionLoading === key.id}
                                                onClick={() => requestTransaction(key.id, 'return')}
                                                style={{ flex: 1, height: '42px', gap: '0.625rem' }}
                                            >
                                                {actionLoading === key.id ? <div className="spinner" style={{ width: 16, height: 16 }} /> : 'Devolver'}
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                disabled={actionLoading === key.id}
                                                onClick={() => requestTransaction(key.id, 'transfer')}
                                                style={{ flex: 1, height: '42px', gap: '0.625rem', border: '1px solid var(--border)' }}
                                            >
                                                Transferir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Modo Lista */
                    viewMode === 'list' && (
                        <div className="portaria-list" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div className="portaria-list-head" style={{
                                display: 'grid', 
                                gridTemplateColumns: '1.5fr 1fr 1.6fr 110px 160px', 
                                padding: '1rem 1rem 1rem 2.5rem', 
                                gap: '1rem',
                                background: 'var(--navy-900)', 
                                borderBottom: '1px solid var(--border)',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: 'white',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase'
                            }}>
                                <div style={{ textAlign: 'left' }}>Item</div>
                                <div style={{ textAlign: 'left' }}>Descrição</div>
                                <div style={{ textAlign: 'left' }}>Posse ou destino</div>
                                <div style={{ textAlign: 'center' }}>Status</div>
                                <div style={{ textAlign: 'center' }}>Ações</div>
                            </div>

                            {filtered.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Nenhum item encontrado com estes filtros.
                                </div>
                            ) : (
                                filtered.map(key => (
                                    <div key={key.id} style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1.5fr 1fr 1.6fr 110px 160px', 
                                        padding: '1rem 1rem 1rem 2.5rem', 
                                        gap: '1rem',
                                        borderBottom: '1px solid var(--border)',
                                        alignItems: 'center',
                                        transition: 'background 0.2s ease'
                                    }} className="list-row-hover">
                                        <button type="button" className="portaria-item-button" onClick={() => pickItem(key.id)}>
                                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                {key.item_type === 'remote' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><circle cx="12" cy="18" r="1"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="14"/></svg> : key.item_type === 'equipment' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
                                            </span>
                                            {key.name}
                                        </button>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'left' }}>
                                            {key.room || '-'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
                                            {key.status === 'in_use' ? (
                                                <Holder item={key} />
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Destino da retirada</div>
                                                    <select
                                                        className="input"
                                                        aria-label={'Destino de ' + key.name}
                                                        style={{ 
                                                            width: '100%', 
                                                            maxWidth: '200px', 
                                                            fontSize: '0.75rem', 
                                                            padding: '0.4rem', 
                                                            height: '32px',
                                                            background: 'var(--bg-card)',
                                                            color: 'var(--text-primary)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            cursor: 'pointer'
                                                        }}
                                                        value={selectedEmployee[key.id] || ''}
                                                        onChange={e => setSelectedEmployee(prev => ({ ...prev, [key.id]: Number(e.target.value) }))}
                                                    >
                                                        <option value="" style={{ background: 'var(--bg-card)' }}>Escolher...</option>
                                                        <optgroup label="Pessoas">
                                                            {sortEmployeesByFrequency(employees, key.id).filter(e => e.entity_type === 'person' || !e.entity_type).map(emp => (
                                                                <option key={emp.id} value={emp.id} style={{ background: 'var(--bg-card)' }}>{emp.name}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label="Locais / Destinos">
                                                            {sortEmployeesByFrequency(employees, key.id).filter(e => e.entity_type === 'location').map(emp => (
                                                                <option key={emp.id} value={emp.id} style={{ background: 'var(--bg-card)' }}>{emp.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <ItemStatusBadge status={key.status} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            {key.status === 'available' ? (
                                                <button
                                                    className="btn btn-gold btn-sm"
                                                    disabled={actionLoading === key.id || !selectedEmployee[key.id]}
                                                    onClick={() => requestTransaction(key.id, 'withdraw')}
                                                    style={{ padding: '0.4rem 1.25rem' }}
                                                >
                                                    Retirar
                                                </button>
                                            ) : (
                                                <>
                                                <button
                                                    className="btn btn-navy btn-sm"
                                                    disabled={actionLoading === key.id}
                                                    onClick={() => requestTransaction(key.id, 'return')}
                                                    style={{ padding: '0.4rem 1.25rem' }}
                                                >
                                                    Devolver
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    disabled={actionLoading === key.id}
                                                    onClick={() => requestTransaction(key.id, 'transfer')}
                                                    style={{ padding: '0.4rem', border: '1px solid var(--border)' }}
                                                    aria-label={'Transferir ' + key.name}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="14" x2="21" y2="3"/><polyline points="8 21 3 21 3 16"/><line x1="20" y1="10" x2="3" y2="21"/></svg>
                                                </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )
                )}
            </main>

            <dialog ref={dialogRef} className="modal-box portaria-dialog" data-action={confirmation?.action}
                aria-labelledby="portaria-confirm-title" aria-describedby="portaria-confirm-item"
                onKeyDown={event => {
                    if (event.key === 'Enter' && event.repeat) event.preventDefault();
                }}
                onCancel={event => {
                    event.preventDefault();
                    if (actionLoading === null) setConfirmation(null);
                }}
            >
                {confirmation && confirmingItem && (
                    <form onSubmit={event => { event.preventDefault(); void confirmAction(); }}>
                        <header className="portaria-dialog-header">
                            <h2 id="portaria-confirm-title" className="modal-title">{actionLabels[confirmation.action]} item</h2>
                            <p id="portaria-confirm-item" className="portaria-dialog-item">{confirmingItem.name}</p>
                            {confirmation.action === 'return' && confirmingItem.employee_name && (
                                <p className="portaria-return-holder">
                                    {confirmingItem.employee_type === 'location' ? 'Em ' : 'Com '}
                                    {confirmingItem.employee_name}
                                </p>
                            )}
                        </header>
                        {confirmation.action !== 'return' && <div className="portaria-dialog-fields">
                            {confirmingItem.status === 'in_use' && (
                                <div className="portaria-dialog-context"><Holder item={confirmingItem} showInitial={false} /></div>
                            )}
                            {(confirmation.action === 'withdraw' || confirmation.fromQuick) && (
                                <div className="portaria-dialog-context">
                                    <div className="portaria-holder">
                                        <small>{confirmation.action === 'withdraw' ? 'Destino da retirada' : 'Novo destino'}</small>
                                        <strong>{employees.find(employee => employee.id === confirmation.destinationId)?.name}</strong>
                                    </div>
                                </div>
                            )}
                            {confirmation.action === 'transfer' && !confirmation.fromQuick && (
                                <div className="input-group">
                                    <label htmlFor="portaria-transfer-destination" className="input-label">Novo destino</label>
                                    <select id="portaria-transfer-destination" className="input" data-initial-focus required
                                        value={confirmation.destinationId ?? ''}
                                        onChange={event => setConfirmation({ ...confirmation, destinationId: Number(event.target.value) || undefined })}
                                    >
                                        <option value="">Selecione uma pessoa ou local</option>
                                        {(['person', 'location'] as const).map(kind => (
                                            <optgroup key={kind} label={kind === 'location' ? 'Locais' : 'Pessoas'}>
                                                {sortEmployeesByFrequency(employees, confirmation.keyId)
                                                    .filter(employee => (employee.entity_type || 'person') === kind)
                                                    .map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="input-group">
                                <label htmlFor="portaria-observation" className="input-label">Observação (opcional)</label>
                                <input id="portaria-observation" className="input" value={confirmation.observation}
                                    onChange={event => setConfirmation({ ...confirmation, observation: event.target.value })}
                                />
                            </div>
                        </div>}
                        <div className="portaria-actions portaria-dialog-footer">
                            <button type="button" className="btn btn-ghost" disabled={actionLoading !== null}
                                data-initial-focus={(!confirmation.focusConfirm && (confirmation.action !== 'transfer' || confirmation.fromQuick)) || undefined}
                                onClick={() => setConfirmation(null)}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-gold" data-initial-focus={confirmation.focusConfirm || undefined}
                                disabled={actionLoading !== null || (confirmation.action !== 'return' && !confirmation.destinationId)}>
                                {actionLoading !== null ? 'Registrando…' : actionLabels[confirmation.action]}
                            </button>
                        </div>
                    </form>
                )}
            </dialog>
        </div>
    );
}
