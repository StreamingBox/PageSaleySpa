export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirmar',
    tone = 'danger',
    onCancel,
    onConfirm
}) {
    if (!open) return null;

    return (
        <div className="dialog">
            <button className="dialog__backdrop" onClick={onCancel} />
            <div className="dialog__panel" role="alertdialog" aria-modal="true">
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="dialog__actions">
                    <button className="button button--ghost" onClick={onCancel} type="button">
                        Cancelar
                    </button>
                    <button
                        className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
                        onClick={onConfirm}
                        type="button"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
