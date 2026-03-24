import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function DrawerForm({
    open,
    title,
    description,
    onClose,
    children,
    eyebrow = 'Vista rápida',
    placement = 'side'
}) {
    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = event => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="drawer">
            <button className="drawer__backdrop" onClick={onClose} />
            <aside
                className={`drawer__panel${
                    placement === 'centered' ? ' drawer__panel--centered' : ''
                }`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <header className="drawer__header">
                    <div>
                        <p className="drawer__eyebrow">{eyebrow}</p>
                        <h3>{title}</h3>
                        {description ? <span>{description}</span> : null}
                    </div>
                    <button className="icon-button" type="button" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>
                <div className="drawer__body">{children}</div>
            </aside>
        </div>
    );
}
