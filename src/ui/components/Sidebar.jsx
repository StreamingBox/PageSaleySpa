import { NavLink } from 'react-router-dom';
import { navigationItems } from '../lib/navigation';

export default function Sidebar({ mobileOpen, onClose }) {
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

                <a className="sidebar__logout" href="/logout">
                    Cerrar sesión
                </a>
            </aside>

            {mobileOpen ? <button className="sidebar__backdrop" onClick={onClose} /> : null}
        </>
    );
}
