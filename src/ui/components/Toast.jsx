import { createContext, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);

    const value = useMemo(
        () => ({
            showToast(message, tone = 'info') {
                const id = Date.now() + Math.random();
                setItems(current => [...current, { id, message, tone }]);
                window.setTimeout(() => {
                    setItems(current => current.filter(item => item.id !== id));
                }, 2800);
            }
        }),
        []
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-stack" role="status" aria-live="polite">
                {items.map(item => (
                    <div key={item.id} className={`toast toast--${item.tone}`}>
                        {item.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast debe usarse dentro de ToastProvider');
    }

    return context;
}
