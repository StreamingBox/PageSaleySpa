import { NavLink } from 'react-router-dom';
import { navigationItems } from '../lib/navigation';
import { getCsrfToken } from '../lib/api';

export default function Sidebar({ mobileOpen, onClose }) {
    const csrfToken = getCsrfToken();

    return (
        <>
            <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
                <div className="sidebar__brand">
                    <img
                        className="sidebar__brand-logo"
                        src="/brand/logo.png"
                        alt="SaleySpa"
                    />
                </div>

                <nav className="sidebar__nav" aria-label="Principal">
                    {navigationItems.map(item => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.to}
                                className={({ isActive }) =>
                                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                                }
                                to={item.to}
                                end={item.to === '/'}
                                onClick={onClose}
                            >
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <form action="/logout" method="POST" className="sidebar__logout-form">
                    <input type="hidden" name="_csrf" value={csrfToken} />
                    <button type="submit" className="sidebar__logout">
                        Cerrar sesión
                    </button>
                </form>
            </aside>

            {mobileOpen ? <button className="sidebar__backdrop" onClick={onClose} /> : null}
        </>
    );
}
