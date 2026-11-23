'use client';

import { createContext, useContext, useState, useTransition } from 'react';
import type { ReactNode } from 'react';

const RouteProgressContext = createContext({
    active: false,
    navigate: (action: () => void) => action(),
});

export function useRouteProgress() {
    return useContext(RouteProgressContext);
}

export function RouteProgressFallback() {
    const { active } = useRouteProgress();

    return active ? null : (
        <div className="route-loading" role="status">
            <span>Carregando tela</span>
        </div>
    );
}

export default function RouteProgress({ children }: { children: ReactNode }) {
    const [navigation, setNavigation] = useState(0);
    const [pending, startTransition] = useTransition();

    function navigate(action: () => void) {
        setNavigation(current => current + 1);
        startTransition(action);
    }

    return (
        <RouteProgressContext.Provider value={{ active: navigation > 0, navigate }}>
            {navigation > 0 && (
                <div
                    key={navigation}
                    className="route-loading route-loading-navigation"
                    data-finishing={!pending || undefined}
                    role={pending ? 'status' : undefined}
                    onAnimationEnd={event => {
                        if (event.animationName === 'route-loading-dismiss') {
                            setNavigation(current => current === navigation ? 0 : current);
                        }
                    }}
                >
                    {pending && <span>Carregando tela</span>}
                </div>
            )}
            {children}
        </RouteProgressContext.Provider>
    );
}
