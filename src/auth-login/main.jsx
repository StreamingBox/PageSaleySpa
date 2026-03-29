import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function RememberSessionToggle({ defaultChecked }) {
    const [checked, setChecked] = useState(defaultChecked);

    return (
        <div className="remember-toggle">
            <button
                aria-checked={checked}
                aria-label="Mantener sesión en este dispositivo"
                className={`remember-toggle__button${checked ? ' remember-toggle__button--checked' : ''}`}
                onClick={() => setChecked(current => !current)}
                type="button"
                role="checkbox"
            >
                <span aria-hidden="true" className="remember-toggle__mark" />
            </button>
            {checked ? <input name="remember_session" type="hidden" value="1" /> : null}
            <span className="remember-toggle__text" onClick={() => setChecked(current => !current)}>
                Mantener sesión en este dispositivo
            </span>
        </div>
    );
}

const mountNode = document.getElementById('remember-session-toggle');

if (mountNode) {
    const defaultChecked = mountNode.dataset.checked === 'true';
    ReactDOM.createRoot(mountNode).render(
        <React.StrictMode>
            <RememberSessionToggle defaultChecked={defaultChecked} />
        </React.StrictMode>
    );
}
