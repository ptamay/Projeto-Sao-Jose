'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import toast from 'react-hot-toast';

interface Key {
    id: number;
    name: string;
    room?: string;
    status: 'available' | 'in_use';
    employee_id?: number;
    employee_name?: string;
    employee_role?: string;
    item_type: 'key' | 'remote' | 'equipment';
}

interface Employee {
    id: number;
    name: string;
    role?: string;
    entity_type: 'person' | 'location';
}

interface Props {
    initialKeys: Key[];
    initialEmployees: Employee[];
    userRole: string;
    userId: number;
    username?: string;
    frequentUsageMap?: Record<number, number[]>;
}

export default function DashboardClient({ initialKeys, initialEmployees, userRole, username, frequentUsageMap = {} }: Props) {
    const [keys, setKeys] = useState<Key[]>(initialKeys || []);
    const [employees] = useState<Employee[]>(initialEmployees || []);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'available' | 'in_use'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<Record<number, number>>({});
    
    // Normalização para busca ignorando acentos
    const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Lógica inteligente de ordenação de funcionários
    const sortEmployeesByFrequency = (employeeList: Employee[], keyId?: number) => {
        if (!keyId || !frequentUsageMap[keyId]) {
            return [...employeeList].sort((a, b) => a.name.localeCompare(b.name));
        }
        const freqIds = frequentUsageMap[keyId];
        return [...employeeList].sort((a, b) => {
            const idxA = freqIds.indexOf(a.id);
            const idxB = freqIds.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
    };

    const getEmployeeSuggestionsForKey = (keyId?: number) => {
        return sortEmployeesByFrequency(employees, keyId).slice(0, 5);
    };
    
    // Sugestões Customizadas (Substituindo o datalist nativo)
    const [keySuggestions, setKeySuggestions] = useState<Key[]>([]);
    const [empSuggestions, setEmpSuggestions] = useState<Employee[]>([]);
    const [showKeyDrops, setShowKeyDrops] = useState(false);
    const [showEmpDrops, setShowEmpDrops] = useState(false);
    const [keyIndex, setKeyIndex] = useState(-1);
    const [empIndex, setEmpIndex] = useState(-1);
    const keyScrollRef = useRef<HTMLDivElement>(null);
    const empScrollRef = useRef<HTMLDivElement>(null);
    const modalOpenTime = useRef<number>(0);

    // Scroll into view logic
    useEffect(() => {
        if (keyIndex >= 0 && keyScrollRef.current) {
            const activeItem = keyScrollRef.current.children[keyIndex] as HTMLElement;
            activeItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [keyIndex]);

    useEffect(() => {
        if (empIndex >= 0 && empScrollRef.current) {
            const activeItem = empScrollRef.current.children[empIndex] as HTMLElement;
            activeItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [empIndex]);

    // Modal de Confirmação
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        keyId: number;
        keyName: string;
        type: 'withdraw' | 'return' | 'transfer';
        employeeId?: number;
        employeeName?: string;
        observation?: string;
    }>({ open: false, keyId: 0, keyName: '', type: 'withdraw' });

    // Processamento Real da Transação (Chamado pelo Modal)
    const handleTransaction = async (keyId: number, type: 'withdraw' | 'return' | 'transfer', employeeId?: number, observation?: string) => {
        setActionLoading(keyId);
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: type, key_id: keyId, employee_id: employeeId || null, observation }),
            });
            const data = await res.json();
            if (res.ok) {
                setKeys(prev => prev.map(k => {
                    if (k.id !== keyId) return k;
                    if (type === 'withdraw' || type === 'transfer') {
                        const emp = employees.find(e => e.id === employeeId);
                        return { ...k, status: 'in_use', employee_id: employeeId, employee_name: emp?.name, employee_role: emp?.role };
                    }
                    return { ...k, status: 'available', employee_id: undefined, employee_name: undefined, employee_role: undefined };
                }));
                if (type === 'withdraw' || type === 'transfer') {
                    setSelectedEmployee(prev => { const n = { ...prev }; delete n[keyId]; return n; });
                }
                toast.success(type === 'withdraw' ? 'Chave retirada com sucesso!' : type === 'transfer' ? 'Chave transferida com sucesso!' : 'Chave devolvida!');
            } else {
                toast.error(data.error || 'Erro na operação.');
            }
        } catch {
            toast.error('Erro de conexão.');
        } finally {
            setActionLoading(null);
            setConfirmModal({ open: false, keyId: 0, keyName: '', type: 'withdraw' });
        }
    };

    // Solicitação de Transação (Abre o Modal)
    const requestTransaction = (keyId: number, type: 'withdraw' | 'return' | 'transfer', manualEmployeeId?: number) => {
        const key = keys.find(k => k.id === keyId);
        if (!key) return;

        const employeeId = manualEmployeeId || (type === 'withdraw' ? selectedEmployee[keyId] : undefined);
        const emp = employees.find(e => e.id === employeeId);

        if (type === 'withdraw' && !employeeId) {
            return toast.error('Selecione um funcionário.');
        }

        setConfirmModal({
            open: true,
            keyId,
            keyName: key.name,
            type,
            employeeId,
            employeeName: emp?.name,
            observation: ''
        });
        modalOpenTime.current = Date.now();
    };

    const confirmAction = () => {
        if (confirmModal.type === 'transfer' && !confirmModal.employeeId) {
            toast.error('Selecione o funcionário para transferir.');
            return;
        }
        handleTransaction(confirmModal.keyId, confirmModal.type, confirmModal.employeeId, confirmModal.observation);
        // Limpar inputs da ação rápida se existirem
        setKeySuggestions([]); 
        setEmpSuggestions([]);
        const keyInp = document.getElementById('unified-key-input') as HTMLInputElement;
        const empInp = document.getElementById('unified-emp-input') as HTMLInputElement;
        if (keyInp) keyInp.value = '';
        if (empInp) empInp.value = '';
        const nextStep = document.getElementById('unified-next-step');
        const confirmBtn = document.getElementById('unified-confirm-btn');
        if (nextStep) nextStep.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'none';
    };

    // Atalhos de teclado para o Modal de Confirmação
    useEffect(() => {
        if (!confirmModal.open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                // Impede confirmação imediata se o modal acabou de abrir (evita conflito com o Enter da ação rápida)
                if (Date.now() - modalOpenTime.current < 150) return;

                e.preventDefault();
                confirmAction();
            } else if (e.key === 'Escape') {
                setConfirmModal(prev => ({ ...prev, open: false }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmModal.open, confirmModal.keyId, confirmModal.type, confirmModal.employeeId]);

    // Initialize state from storage
    useEffect(() => {
        const savedView = localStorage.getItem('dashboard-view') as 'grid' | 'list' | null;
        if (savedView) setViewMode(savedView);
    }, []);

    const toggleView = (mode: 'grid' | 'list') => {
        setViewMode(mode);
        localStorage.setItem('dashboard-view', mode);
    };

    const stats = useMemo(() => ({
        total: keys.length,
        available: keys.filter(k => k.status === 'available').length,
        inUse: keys.filter(k => k.status === 'in_use').length,
    }), [keys]);

    const filtered = useMemo(() => {
        const s = normalize(search);
        return keys
            .filter(k => {
                const matchSearch = normalize(k.name).includes(s) ||
                    normalize(k.room || '').includes(s) ||
                    normalize(k.employee_name || '').includes(s);
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

            <main className="main-content">
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

                {/* 2. Unified Control Bar (Search + Quick Action) */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    {/* Search */}
                    <div className="search-bar" style={{ flex: '1', minWidth: '200px' }}>
                        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                            className="input"
                            style={{ paddingLeft: '2.5rem', height: '38px', background: 'transparent', border: 'none' }}
                            placeholder="Buscar item, pessoa ou local..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

                    {/* Integrated Quick Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '2', minWidth: '300px', flexWrap: 'wrap' }}>
                        <div style={{ color: 'var(--gold-500)', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                        </div>
                        
                        {/* Campo de Chave com Sugestões Customizadas */}
                        <div style={{ position: 'relative', flex: 1 }}>
                            <input 
                                className="input" 
                                placeholder="Ação Rápida: Qual a chave?" 
                                id="unified-key-input"
                                autoComplete="off"
                                style={{ height: '38px', fontSize: '0.8rem', border: '1px solid var(--border-strong)', width: '100%' }}
                                onFocus={() => {
                                    setShowKeyDrops(true);
                                    setKeyIndex(-1);
                                    if (keySuggestions.length === 0) {
                                        const initial = [...keys].sort((a, b) => {
                                            if (a.status === 'in_use' && b.status === 'available') return -1;
                                            if (a.status === 'available' && b.status === 'in_use') return 1;
                                            return a.name.localeCompare(b.name);
                                        }).slice(0, 8);
                                        setKeySuggestions(initial);
                                    }
                                }}
                                onBlur={() => setTimeout(() => setShowKeyDrops(false), 200)}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setKeyIndex(prev => (prev < keySuggestions.length - 1 ? prev + 1 : prev));
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setKeyIndex(prev => (prev > 0 ? prev - 1 : 0));
                                    } else if (e.key === 'Escape') {
                                        setShowKeyDrops(false);
                                    } else if (e.key === 'Enter') {
                                        const val = normalize(e.currentTarget.value.trim());
                                        const selected = keyIndex >= 0 ? keySuggestions[keyIndex] : null;
                                        const match = selected || keySuggestions[0] || keys.find(k => normalize(k.name).includes(val));
                                        
                                        if (match) {
                                            e.currentTarget.value = match.name;
                                            if (match.status === 'available') {
                                                const nextField = document.getElementById('unified-next-step');
                                                const withdrawField = document.getElementById('withdraw-step');
                                                if (nextField) nextField.style.display = 'block';
                                                if (withdrawField) withdrawField.style.display = 'block';
                                                setTimeout(() => {
                                                    const empInp = document.getElementById('unified-emp-input') as HTMLInputElement;
                                                    empInp?.focus();
                                                    setEmpSuggestions(getEmployeeSuggestionsForKey(match.id));
                                                }, 10);
                                            } else {
                                                requestTransaction(match.id, 'return');
                                            }
                                            setShowKeyDrops(false);
                                        }
                                    }
                                }}
                                onChange={(e) => {
                                    const val = normalize(e.target.value.trim());
                                    const filtered = keys
                                        .filter(k => normalize(k.name).includes(val))
                                        .sort((a, b) => {
                                            if (a.status === 'in_use' && b.status === 'available') return -1;
                                            if (a.status === 'available' && b.status === 'in_use') return 1;
                                            return a.name.localeCompare(b.name);
                                        })
                                        .slice(0, 8);
                                    setKeySuggestions(filtered);
                                    setKeyIndex(-1);
                                    
                                    const match = keys.find(k => normalize(k.name) === val);
                                    const nextField = document.getElementById('unified-next-step');
                                    const withdrawField = document.getElementById('withdraw-step');
                                    const returnField = document.getElementById('return-step');
                                    const btn = document.getElementById('unified-confirm-btn');

                                    if (match) {
                                        if (nextField) nextField.style.display = 'block';
                                        if (match.status === 'available') {
                                            if (withdrawField) withdrawField.style.display = 'block';
                                            if (returnField) returnField.style.display = 'none';
                                            if (btn) { btn.innerText = 'Retirar'; btn.className = 'btn btn-gold btn-sm'; btn.style.display = 'block'; }
                                            setTimeout(() => {
                                                const empInp = document.getElementById('unified-emp-input') as HTMLInputElement;
                                                empInp?.focus();
                                                setEmpSuggestions(getEmployeeSuggestionsForKey(match.id));
                                            }, 10);
                                        } else {
                                            if (withdrawField) withdrawField.style.display = 'none';
                                            if (returnField) { 
                                                returnField.style.display = 'block';
                                                const holderSpan = document.getElementById('current-holder-name');
                                                if (holderSpan) holderSpan.innerText = match.employee_name || '';
                                            }
                                            if (btn) { btn.innerText = 'Devolver'; btn.className = 'btn btn-navy btn-sm'; btn.style.display = 'block'; }
                                        }
                                    } else {
                                        if (nextField) nextField.style.display = 'none';
                                        if (btn) btn.style.display = 'none';
                                    }
                                }}
                            />
                            {showKeyDrops && keySuggestions.length > 0 && (
                                <div 
                                    ref={keyScrollRef}
                                    style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: '300px', overflowY: 'auto', marginTop: '1px' }}
                                >
                                    {keySuggestions.map((k, index) => (
                                        <div 
                                            key={k.id} 
                                            style={{ 
                                                padding: '0.6rem 1rem', 
                                                cursor: 'pointer', 
                                                borderBottom: '1px solid var(--border)', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                background: keyIndex === index ? 'var(--gold-50)' : 'transparent',
                                                borderLeft: keyIndex === index ? '4px solid var(--gold-500)' : '4px solid transparent'
                                            }}
                                            onMouseDown={() => {
                                                const inp = document.getElementById('unified-key-input') as HTMLInputElement;
                                                if (inp) {
                                                    inp.value = k.name;
                                                    if (k.status === 'available') {
                                                        const nextField = document.getElementById('unified-next-step');
                                                        if (nextField) nextField.style.display = 'block';
                                                        document.getElementById('withdraw-step')!.style.display = 'block';
                                                        const btn = document.getElementById('unified-confirm-btn');
                                                        if (btn) {
                                                            btn.innerText = 'Retirar';
                                                            btn.className = 'btn btn-gold btn-sm';
                                                            btn.style.display = 'block';
                                                        }
                                                        setTimeout(() => {
                                                            const empInp = document.getElementById('unified-emp-input') as HTMLInputElement;
                                                            empInp?.focus();
                                                            setEmpSuggestions(getEmployeeSuggestionsForKey(k.id));
                                                        }, 10);
                                                    } else {
                                                        requestTransaction(k.id, 'return');
                                                    }
                                                }
                                            }}
                                            className="suggestion-item"
                                        >
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{k.name}</span>
                                            <span style={{ fontSize: '0.7rem', color: k.status === 'available' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                {k.status === 'available' ? '✅ DISPONÍVEL' : `❌ COM ${k.employee_name?.toUpperCase()}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div id="unified-next-step" style={{ display: 'none' }}>
                            <div id="withdraw-step" style={{ position: 'relative' }}>
                                <input 
                                    className="input" 
                                    placeholder="Para quem?" 
                                    id="unified-emp-input"
                                    autoComplete="off"
                                    style={{ height: '38px', fontSize: '0.8rem', width: '220px' }}
                                    onFocus={() => {
                                        setShowEmpDrops(true);
                                        setEmpIndex(-1);
                                        if (empSuggestions.length === 0) {
                                            const keyName = (document.getElementById('unified-key-input') as HTMLInputElement)?.value;
                                            const key = keys.find(k => normalize(k.name) === normalize(keyName || ''));
                                            setEmpSuggestions(getEmployeeSuggestionsForKey(key?.id));
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setShowEmpDrops(false), 200)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
                                            setEmpIndex(prev => (prev < empSuggestions.length - 1 ? prev + 1 : prev));
                                        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
                                            setEmpIndex(prev => (prev > 0 ? prev - 1 : 0));
                                        } else if (e.key === 'Escape') {
                                            setShowEmpDrops(false);
                                        } else if (e.key === 'Enter') {
                                            const val = normalize(e.currentTarget.value);
                                            const selected = empIndex >= 0 ? empSuggestions[empIndex] : null;
                                            const match = selected || empSuggestions[0] || employees.find(emp => normalize(emp.name).includes(val));
                                            
                                            if (match) {
                                                e.currentTarget.value = match.name;
                                                const keyName = (document.getElementById('unified-key-input') as HTMLInputElement).value;
                                                const key = keys.find(k => normalize(k.name) === normalize(keyName));
                                                if (key) requestTransaction(key.id, 'withdraw', match.id);
                                            }
                                        }
                                    }}
                                    onChange={(e) => {
                                        const val = normalize(e.target.value);
                                        const keyName = (document.getElementById('unified-key-input') as HTMLInputElement)?.value;
                                        const key = keys.find(k => normalize(k.name) === normalize(keyName || ''));
                                        const filtered = employees.filter(emp => normalize(emp.name).includes(val));
                                        setEmpSuggestions(sortEmployeesByFrequency(filtered, key?.id).slice(0, 5));
                                        setEmpIndex(-1);
                                    }}
                                />
                                {showEmpDrops && empSuggestions.length > 0 && (
                                    <div 
                                        ref={empScrollRef}
                                        style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', marginTop: '1px' }}
                                    >
                                        {empSuggestions.map((e, index) => (
                                            <div 
                                                key={e.id} 
                                                style={{ 
                                                    padding: '0.6rem 1rem', 
                                                    cursor: 'pointer', 
                                                    borderBottom: '1px solid var(--border)',
                                                    background: empIndex === index ? 'var(--gold-50)' : 'transparent',
                                                    borderLeft: empIndex === index ? '4px solid var(--gold-500)' : '4px solid transparent'
                                                }}
                                                onMouseDown={() => {
                                                    const inp = document.getElementById('unified-emp-input') as HTMLInputElement;
                                                    if (inp) {
                                                        inp.value = e.name;
                                                        const keyName = (document.getElementById('unified-key-input') as HTMLInputElement).value;
                                                        const key = keys.find(k => k.name.toLowerCase() === keyName.toLowerCase());
                                                        if (key) {
                                                            requestTransaction(key.id, 'withdraw', e.id);
                                                            setShowEmpDrops(false);
                                                        }
                                                    }
                                                }}
                                                className="suggestion-item"
                                            >
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{e.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.role}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div id="return-step" style={{ display: 'none' }}>
                                <div style={{ height: '38px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Com: <strong id="current-holder-name" style={{ color: 'var(--text-primary)' }}>-</strong></span>
                                </div>
                            </div>
                        </div>
                        <button 
                            id="unified-confirm-btn"
                            className="btn btn-gold btn-sm" 
                            style={{ height: '38px', minWidth: '90px', display: 'none' }}
                            onClick={() => {
                                const keyName = normalize((document.getElementById('unified-key-input') as HTMLInputElement).value.trim());
                                const key = keys.find(k => normalize(k.name) === keyName);
                                if (!key) return toast.error('Chave inválida.');
                                if (key.status === 'available') {
                                    const empName = normalize((document.getElementById('unified-emp-input') as HTMLInputElement).value.trim());
                                    const emp = employees.find(e => normalize(e.name) === empName);
                                    if (!emp) return toast.error('Funcionário não encontrado. Selecione da lista.');
                                    requestTransaction(key.id, 'withdraw', emp.id);
                                } else {
                                    requestTransaction(key.id, 'return');
                                }
                            }}
                        >
                            Confirmar
                        </button>
                    </div>
                </div>

                {/* 3. Filters & Mode Toggle Row */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                    {(['all','available','in_use'] as const).map(f => (
                        <button 
                            key={f} 
                            className={`btn ${filter === f ? 'btn-gold' : 'btn-ghost'} btn-sm`} 
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'Todas' : f === 'available' ? 'Disponíveis' : 'Em Uso'}
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
                        <p>Nenhuma chave encontrada.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {filtered.map(key => (
                            <div key={key.id} className={`key-card ${key.status === 'in_use' ? 'inuse' : 'available'}`}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem' }}>
                                    <div style={{ flex: 1 }} className="key-card-header-content">
                                        <div className="key-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                {key.item_type === 'remote' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><circle cx="12" cy="18" r="1"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="14"/></svg> : key.item_type === 'equipment' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
                                            </span>
                                            {key.name}
                                        </div>
                                        {key.room && <div className="key-card-room">{key.room}</div>}
                                    </div>
                                    <span className={`status-tag ${key.status === 'available' ? 'status-available' : 'status-inuse'}`}>
                                        {key.status === 'available' ? 'Disponível' : 'Em Uso'}
                                    </span>
                                </div>

                                <div className="key-card-dynamic-area">
                                    {key.status === 'in_use' && key.employee_name ? (
                                        <div className="key-card-holder animate-fade" style={{ width: '100%', marginTop: 0 }}>
                                            <div className="key-card-avatar">
                                                {key.employee_name[0].toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key.employee_name}</div>
                                                {key.employee_role && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{key.employee_role}</div>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                                            <select
                                                className="input"
                                                style={{ flex: 1, fontSize: '0.8125rem', height: '38px', padding: '0 2rem 0 0.75rem' }}
                                                value={selectedEmployee[key.id] || ''}
                                                onChange={e => setSelectedEmployee(prev => ({ ...prev, [key.id]: Number(e.target.value) }))}
                                            >
                                                <option value="">Para quem?</option>
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
                        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ 
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
                                <div style={{ textAlign: 'left' }}>Nome</div>
                                <div style={{ textAlign: 'left' }}>Descrição</div>
                                <div style={{ textAlign: 'left' }}>Portador</div>
                                <div style={{ textAlign: 'center' }}>Status</div>
                                <div style={{ textAlign: 'center' }}>Ações</div>
                            </div>

                            {filtered.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Nenhuma chave encontrada com estes filtros.
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', textAlign: 'left' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                                                {key.item_type === 'remote' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><circle cx="12" cy="18" r="1"/><line x1="12" y1="6" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="12" y1="14" x2="12" y2="14"/></svg> : key.item_type === 'equipment' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>}
                                            </span>
                                            {key.name}
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'left' }}>
                                            {key.room || '-'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
                                            {key.status === 'in_use' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', minWidth: 0 }}>
                                                    <div style={{ width: '32px', height: '32px', background: 'var(--gold-100)', color: '#92400e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, flexShrink: 0, border: '2px solid white', boxShadow: 'var(--shadow-sm)' }}>
                                                        {key.employee_name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '-2px', letterSpacing: '0.025em' }}>Portador Atual</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key.employee_name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--gold-600)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key.employee_role || 'Funcionário'}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Selecionar Funcionário</div>
                                                    <select
                                                        className="input"
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
                                            <span className={`status-tag ${key.status === 'available' ? 'status-available' : 'status-inuse'}`}>
                                                {key.status === 'available' ? 'Disponível' : 'Em Uso'}
                                            </span>
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
                                                    title="Transferir"
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

            {/* Modal de Confirmação Premium */}
            {confirmModal.open && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,10,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', overflow: 'hidden', animation: 'modalIn 0.3s ease-out' }}>
                        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <div style={{ width: '48px', height: '48px', background: confirmModal.type === 'withdraw' ? 'var(--gold-100)' : 'var(--navy-100)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                {confirmModal.type === 'withdraw' ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold-600)" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--navy-600)" strokeWidth="2.5"><path d="M12 2v20m-5-5l5 5 5-5"/></svg>
                                )}
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-900)', marginBottom: '0.5rem' }}>
                                {confirmModal.type === 'withdraw' ? 'Confirmar Retirada?' : confirmModal.type === 'transfer' ? 'Confirmar Transferência?' : 'Confirmar Devolução?'}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                Você está prestes a {confirmModal.type === 'withdraw' ? 'entregar' : confirmModal.type === 'transfer' ? 'transferir' : 'receber'} a chave <strong style={{ color: 'var(--navy-900)' }}>"{confirmModal.keyName}"</strong> 
                                {confirmModal.type === 'withdraw' && (
                                    <span> para <strong style={{ color: 'var(--gold-600)' }}>{confirmModal.employeeName}</strong></span>
                                )}.
                            </p>
                            {confirmModal.type === 'transfer' && (
                                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Para quem?</label>
                                    <select 
                                        className="input" 
                                        style={{ width: '100%', marginTop: '0.25rem', height: '38px', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                                        value={confirmModal.employeeId || ''}
                                        onChange={e => setConfirmModal(prev => ({ ...prev, employeeId: Number(e.target.value) }))}
                                    >
                                        <option value="">Selecione um funcionário...</option>
                                        {sortEmployeesByFrequency(employees, confirmModal.keyId).map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {(confirmModal.type === 'withdraw' || confirmModal.type === 'transfer') && (
                                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Observação (opcional)</label>
                                    <input 
                                        type="text"
                                        className="input"
                                        placeholder="Ex: Para manutenção..."
                                        value={confirmModal.observation || ''}
                                        onChange={e => setConfirmModal(prev => ({ ...prev, observation: e.target.value }))}
                                        style={{ width: '100%', marginTop: '0.25rem', height: '38px', fontSize: '0.8rem' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1rem', background: '#f8fafc', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button 
                                className="btn btn-ghost" 
                                style={{ border: '1px solid var(--border)' }}
                                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                            >
                                Cancelar
                            </button>
                            <button 
                                className={`btn ${confirmModal.type === 'withdraw' ? 'btn-gold' : 'btn-navy'}`}
                                onClick={confirmAction}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                    <style jsx>{`
                        @keyframes modalIn {
                            from { opacity: 0; transform: scale(0.95) translateY(10px); }
                            to { opacity: 1; transform: scale(1) translateY(0); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
