import { Menu, MoonStar, SunMedium } from 'lucide-react';

export default function TopBar({ meta, onOpenMenu, theme, onToggleTheme }) {
    const initialState = window.__APP_STATE__ || {};
    const user = initialState.user || {};
    const isDark = theme === 'dark';
    const ThemeIcon = isDark ? SunMedium : MoonStar;

    return (
        <header className="topbar">
            <button
                className="topbar__menu"
                onClick={onOpenMenu}
                type="button"
                aria-label="Abrir navegación"
            >
                <Menu size={18} />
            </button>

            <img
                className="topbar__logo"
                src="/brand/logo.png"
                alt="SaleySpa"
            />

            <div className="topbar__copy">
                <p className="topbar__eyebrow">SaleySpa</p>
                <h2>{meta.title}</h2>
                <span>{meta.description}</span>
            </div>

            <div className="topbar__user">
                <button
                    className="theme-toggle"
                    onClick={onToggleTheme}
                    type="button"
                    aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                    <ThemeIcon size={16} />
                    <span>{isDark ? 'Claro' : 'Oscuro'}</span>
                </button>

                <div className="topbar__avatar" aria-hidden="true">
                    {(user.username || user.email || 'S').slice(0, 1).toUpperCase()}
                </div>
            </div>
        </header>
    );
}
