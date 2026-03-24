import { NavLink } from 'react-router-dom';
import { mobileNavigationItems } from '../lib/navigation';

export default function MobileBottomNav() {
    return (
        <nav className="mobile-bottom-nav" aria-label="Navegacion movil">
            {mobileNavigationItems.map(item => {
                const Icon = item.icon;

                return (
                    <NavLink
                        key={item.to}
                        className={({ isActive }) =>
                            `mobile-bottom-nav__link ${
                                isActive ? 'mobile-bottom-nav__link--active' : ''
                            }`
                        }
                        to={item.to}
                        end={item.to === '/'}
                    >
                        <Icon size={18} />
                        <span>{item.label}</span>
                    </NavLink>
                );
            })}
        </nav>
    );
}
