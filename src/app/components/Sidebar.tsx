'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

interface SidebarProps {
    userRole: string;
    username?: string;
    onMobileClose?: () => void;
    isOpen?: boolean;
}

const navItems = [
    {
        section: 'Principal',
        items: [
            { href: '/', label: 'Dashboard', icon: 'grid', roles: ['ADMIN','PORTEIRO','USER'] },
            { href: '/keys', label: 'Chaves', icon: 'key', roles: ['ADMIN','PORTEIRO','USER'] },
            { href: '/employees', label: 'Funcionários', icon: 'users', roles: ['ADMIN','PORTEIRO','USER'] },
        ]
    },
    {
        section: 'Registros',
        items: [
            { href: '/history', label: 'Histórico', icon: 'clock', roles: ['ADMIN','PORTEIRO','USER'] },
        ]
    },
    {
        section: 'Administração',
        items: [
            { href: '/users', label: 'Usuários do Sistema', icon: 'shield', roles: ['ADMIN'] },
            { href: '/logs', label: 'Logs de Auditoria', icon: 'file-text', roles: ['ADMIN'] },
            { href: '/settings', label: 'Configurações', icon: 'settings', roles: ['ADMIN'] },
        ]
    },
];

function Icon({ name }: { name: string }) {
    const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    switch (name) {
        case 'grid': return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
        case 'key': return <svg {...props}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
        case 'users': return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
        case 'clock': return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
        case 'shield': return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
        case 'file-text': return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
        case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
        case 'log-out': return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
        case 'sun': return <svg {...props}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
        case 'moon': return <svg {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
        default: return null;
    }
}

export default function Sidebar({ userRole, username, onMobileClose, isOpen }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Initialize theme and collapse state
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            if (savedTheme === 'light') document.documentElement.classList.add('light-mode');
        }

        const savedCollapse = localStorage.getItem('sidebar-collapsed') === 'true';
        setIsCollapsed(savedCollapse);
        if (savedCollapse) document.documentElement.classList.add('sidebar-collapsed');
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'light') {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    };

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', String(newState));
        if (newState) {
            document.documentElement.classList.add('sidebar-collapsed');
        } else {
            document.documentElement.classList.remove('sidebar-collapsed');
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    // Auto logout check
    useEffect(() => {
        const checkAutoLogout = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (data.autoLogoutTime) {
                    const checkInterval = setInterval(() => {
                        const now = new Date();
                        const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        if (currentHHMM === data.autoLogoutTime) {
                            console.log('[Auto Logout] Scheduled time reached. Logging out...');
                            handleLogout();
                        }
                    }, 60000); // Check every minute
                    return () => clearInterval(checkInterval);
                }
            } catch (e) {
                console.error('Failed to initialize auto logout check');
            }
        };
        checkAutoLogout();
    }, []);

    const navigate = (href: string) => {
        router.push(href);
        onMobileClose?.();
    };

    const roleBadge = userRole === 'ADMIN' ? 'badge-admin' : userRole === 'PORTEIRO' ? 'badge-porteiro' : 'badge-user';
    const roleLabel = userRole === 'ADMIN' ? 'Admin' : userRole === 'PORTEIRO' ? 'Porteiro' : 'Usuário';

    return (
        <>
            {isOpen && <div className="sidebar-overlay active" onClick={onMobileClose} />}
            <aside className={`sidebar${isOpen ? ' open' : ''}`}>
                {/* Logo Section */}
                <div className="sidebar-logo" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
                    {!isCollapsed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, overflow: 'hidden' }}>
                            <Image src="/logo/logo.png" alt="CSJ" width={42} height={42} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            <div className="sidebar-logo-text">
                                <div style={{ whiteSpace: 'nowrap' }}>Colégio São José</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--navy-300)', whiteSpace: 'nowrap', marginTop: '2px', opacity: 0.9 }}>Gestão de Chaves</div>
                            </div>
                        </div>
                    )}
                    {/* Toggle Button Desktop */}
                    <button 
                        className="btn-toggle-sidebar" 
                        onClick={toggleCollapse}
                        style={{ background: 'transparent', border: 'none', color: '#5b7ab8', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: '0.3s' }}>
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {navItems.map(section => {
                        const visible = section.items.filter(i => i.roles.includes(userRole));
                        if (!visible.length) return null;
                        return (
                            <div key={section.section}>
                                <div className="nav-section-title">{section.section}</div>
                                {visible.map(item => (
                                    <button
                                        key={item.href}
                                        className={`nav-item${pathname === item.href ? ' active' : ''}`}
                                        onClick={() => navigate(item.href)}
                                        title={isCollapsed ? item.label : ''}
                                    >
                                        <span className="nav-icon"><Icon name={item.icon} /></span>
                                        <span className="nav-item-text" style={{ marginLeft: '0.125rem' }}>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    {/* Theme Toggle */}
                    <button 
                        className="nav-item" 
                        onClick={toggleTheme} 
                        style={{ marginBottom: '0.5rem', padding: isCollapsed ? '0.75rem' : undefined }}
                    >
                        <span className="nav-icon" style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                            {theme === 'dark' ? <Icon name="sun" /> : <Icon name="moon" />}
                        </span>
                        {!isCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, marginLeft: '0.75rem' }}>
                                <span className="nav-item-text">Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                                <div style={{ width: 32, height: 16, background: theme === 'light' ? 'var(--gold-400)' : 'var(--navy-700)', borderRadius: 99, position: 'relative' }}>
                                    <div style={{ width: 12, height: 12, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: theme === 'light' ? 18 : 2, transition: '0.3s' }} />
                                </div>
                            </div>
                        )}
                    </button>

                    <div className="user-profile-compact" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 0.875rem', marginBottom: '0.625rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold-500), var(--gold-300))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--navy-900)', flexShrink: 0 }}>
                            {username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {!isCollapsed && (
                            <div style={{ flex: 1, minWidth: 0 }} className="user-info-text">
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'Usuário'}</div>
                                <span className={`badge ${roleBadge}`} style={{ transform: 'scale(0.85)', transformOrigin: 'left' }}>{roleLabel}</span>
                            </div>
                        )}
                    </div>
                    <button className="nav-item" onClick={handleLogout} style={{ color: '#f87171', width: '100%', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                        <span className="nav-icon"><Icon name="log-out" /></span>
                        <span className="nav-item-text">Sair</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

