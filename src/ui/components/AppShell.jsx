import { useEffect, useState } from 'react';
import MobileBottomNav from './MobileBottomNav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const THEME_KEY = 'saleyspa-theme';

function getInitialTheme() {
    if (typeof window === 'undefined') return 'light';

    try {
        const savedTheme = window.localStorage.getItem(THEME_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
    } catch (_error) {
        // Ignore storage access failures and fall back to system preference.
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export default function AppShell({ children, meta }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.body.classList.toggle('app-no-scroll', mobileOpen);
        return () => document.body.classList.remove('app-no-scroll');
    }, [mobileOpen]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;

        try {
            window.localStorage.setItem(THEME_KEY, theme);
        } catch (_error) {
            // Ignore storage access failures.
        }
    }, [theme]);

    return (
        <div className="app-shell">
            <div className="app-shell__ornament app-shell__ornament--one" />
            <div className="app-shell__ornament app-shell__ornament--two" />
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
            <div className="app-shell__main">
                <TopBar
                    meta={meta}
                    onOpenMenu={() => setMobileOpen(true)}
                    theme={theme}
                    onToggleTheme={() =>
                        setTheme(current => (current === 'dark' ? 'light' : 'dark'))
                    }
                />
                <main className="app-shell__content">{children}</main>
                <MobileBottomNav />
            </div>
        </div>
    );
}
