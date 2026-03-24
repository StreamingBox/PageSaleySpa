import { TriangleAlert } from 'lucide-react';

export default function KpiCard({
    label,
    value,
    note,
    accent = 'indigo',
    valueTag = null
}) {
    const showAlert = accent === 'danger';

    return (
        <article className={`kpi-card kpi-card--${accent}`}>
            <div className="kpi-card__top">
                <span className="kpi-card__label">{label}</span>
                {showAlert ? (
                    <span className="kpi-card__badge kpi-card__badge--danger">
                        <TriangleAlert size={14} />
                        Alerta
                    </span>
                ) : null}
            </div>

            <div className="kpi-card__value-row">
                <strong className="kpi-card__value">{value}</strong>
                {valueTag ? (
                    <span
                        className={`kpi-card__value-tag ${
                            showAlert ? 'kpi-card__value-tag--danger' : ''
                        }`}
                    >
                        {valueTag}
                    </span>
                ) : null}
            </div>

            {note ? (
                <p className={`kpi-card__note ${showAlert ? 'kpi-card__note--danger' : ''}`}>
                    {note}
                </p>
            ) : null}
        </article>
    );
}
