import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    CalendarRange,
    ChartColumnBig,
    Package,
    Plus,
    ShoppingBag,
    Trophy
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatMoney } from '../lib/format';
import EmptyState from '../components/EmptyState';

const MONTH_COMPARE_LIMIT = 6;
const MONTH_SERIES_COLORS = [
    '#a777cf',
    '#79cfcd',
    '#7db68d',
    '#d7a56f',
    '#d84f5f',
    '#c58fcf',
    '#8d84a0',
    '#90c9c8',
    '#cdb3de',
    '#e4b98f',
    '#9eb7df',
    '#c6a46d'
];

function getMonthAccent(month) {
    return MONTH_SERIES_COLORS[month?.monthIndex % MONTH_SERIES_COLORS.length] || '#a777cf';
}

function pickDefaultMonths(months) {
    const activeMonths = months.filter(month => month.revenue > 0);
    return activeMonths.slice(-2).map(month => month.key);
}

function buildComparisonData(months, selectedKeys, granularity) {
    const selectedMonths = months.filter(month => selectedKeys.includes(month.key));
    const maxPoints = selectedMonths.reduce(
        (max, month) => Math.max(max, month.series[granularity].length),
        0
    );

    const labels = Array.from({ length: maxPoints }, (_, index) =>
        granularity === 'weekly' ? `Sem ${index + 1}` : String(index + 1)
    );

    const series = selectedMonths.map(month => ({
        key: month.key,
        label: month.label,
        color: getMonthAccent(month),
        values: labels.map((_, index) => month.series[granularity][index]?.revenue || 0)
    }));

    return {
        labels,
        series
    };
}

function getSeriesRange(series) {
    const values = series.flatMap(item => item.values);
    const max = Math.max(...values, 0);
    return max > 0 ? max : 1;
}

function buildLinePath(values, maxValue, width, height, tension = 0.22) {
    if (!values.length) return '';
    const stepX = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((value, index) => ({
        x: index * stepX,
        y: height - (value / maxValue) * height
    }));

    if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const controlX = current.x + (next.x - current.x) * tension;
        const nextControlX = next.x - (next.x - current.x) * tension;

        path += ` C ${controlX} ${current.y}, ${nextControlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
}

function buildAreaPath(values, maxValue, width, height) {
    const linePath = buildLinePath(values, maxValue, width, height);
    if (!linePath) return '';

    return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

function formatCompactMoney(value) {
    const number = Number(value || 0);

    if (number >= 1000000) {
        return `$${(number / 1000000).toFixed(1)}M`;
    }

    if (number >= 1000) {
        return `$${Math.round(number / 1000)}K`;
    }

    return formatMoney(number);
}

function buildDonutSegments(items) {
    const total = items.reduce((sum, item) => sum + item.percentage, 0) || 100;
    let currentOffset = 25;

    return items.map(item => {
        const size = (item.percentage / total) * 100;
        const segment = {
            ...item,
            dash: `${size} ${100 - size}`,
            offset: currentOffset
        };

        currentOffset -= size;
        return segment;
    });
}

function ComparisonChart({ labels, series, granularity, chartStyle }) {
    const width = 1120;
    const height = 330;
    const maxValue = getSeriesRange(series);
    const gridSteps = 4;

    if (!series.length) {
        return <p className="metric-empty">No hay series para comparar.</p>;
    }

    return (
        <div className="chart-shell chart-shell--tall">
            <svg className="chart-svg" viewBox={`0 0 ${width} ${height + 56}`} role="img">
                {Array.from({ length: gridSteps + 1 }, (_, index) => {
                    const y = (height / gridSteps) * index;
                    const value = maxValue - (maxValue / gridSteps) * index;

                    return (
                        <g key={index}>
                            <line className="chart-grid-line" x1="64" x2={width} y1={y + 8} y2={y + 8} />
                            <text className="chart-axis-text" x="0" y={y + 13}>
                                {formatCompactMoney(value)}
                            </text>
                        </g>
                    );
                })}

                {series.map(item => {
                    const linePath = buildLinePath(item.values, maxValue, width - 64, height - 12);
                    const areaPath = buildAreaPath(item.values, maxValue, width - 64, height - 12);

                    return (
                        <g key={item.key} transform="translate(64 8)">
                            {chartStyle === 'area' ? (
                                <path
                                    d={areaPath}
                                    fill={item.color}
                                    fillOpacity="0.12"
                                    stroke="none"
                                />
                            ) : null}
                            <path
                                d={linePath}
                                fill="none"
                                stroke={item.color}
                                strokeDasharray={item.key === series[0].key ? undefined : '8 6'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="4"
                            />
                        </g>
                    );
                })}

                {labels.map((label, index) => {
                    const x =
                        64 + (labels.length > 1 ? ((width - 64) / (labels.length - 1)) * index : 0);

                    return (
                        <text
                            key={label}
                            className="chart-axis-value"
                            textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}
                            x={x}
                            y={height + 44}
                        >
                            {granularity === 'weekly' ? label : label}
                        </text>
                    );
                })}
            </svg>

            <div className="chart-legend">
                {series.map(item => (
                    <span
                        className="chart-legend__item analytics-legend-item"
                        key={item.key}
                        style={{
                            '--legend-accent': item.color
                        }}
                    >
                        <span
                            className="chart-legend__swatch"
                            style={{ background: item.color }}
                        />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function DonutChart({ items }) {
    const segments = buildDonutSegments(items.slice(0, 8));

    return (
        <div className="analytics-donut">
            <svg viewBox="0 0 120 120" role="img">
                <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
                {segments.map(segment => (
                    <circle
                        key={segment.name}
                        cx="60"
                        cy="60"
                        r="42"
                        fill="none"
                        stroke={segment.color}
                        strokeDasharray={segment.dash}
                        strokeDashoffset={segment.offset}
                        strokeLinecap="round"
                        strokeWidth="14"
                        pathLength="100"
                    />
                ))}
                <text x="60" y="56" textAnchor="middle" className="analytics-donut__label">
                    CUOTA
                </text>
                <text x="60" y="72" textAnchor="middle" className="analytics-donut__value">
                    100%
                </text>
            </svg>
        </div>
    );
}

export default function AnalyticsPage() {
    const [year, setYear] = useState('');
    const [granularity, setGranularity] = useState('monthly');
    const [chartStyle, setChartStyle] = useState('area');
    const [selectedMonths, setSelectedMonths] = useState([]);

    const analyticsQuery = useQuery({
        queryKey: ['sales-analytics', year],
        queryFn: () => apiFetch(`/api/analytics/sales?year=${encodeURIComponent(year)}`)
    });

    const payload = analyticsQuery.data?.data;

    useEffect(() => {
        if (!payload?.years?.length) {
            return;
        }

        setYear(current => (current ? current : String(payload.year || payload.years[0])));
    }, [payload?.year, payload?.years]);

    useEffect(() => {
        if (!payload?.months?.length) {
            return;
        }

        const defaultMonths = pickDefaultMonths(payload.months);
        setSelectedMonths(current =>
            current.length && current.every(key => payload.months.some(month => month.key === key))
                ? current
                : defaultMonths
        );
    }, [payload]);

    const selectedMonthRows = useMemo(
        () => payload?.months?.filter(month => selectedMonths.includes(month.key)) || [],
        [payload, selectedMonths]
    );

    const primaryMonth = selectedMonthRows[0] || payload?.active_months?.slice(-1)[0] || null;
    const secondaryMonth = selectedMonthRows[1] || null;
    const comparison = useMemo(
        () => buildComparisonData(payload?.months || [], selectedMonths, granularity),
        [payload, selectedMonths, granularity]
    );

    const selectedTotalRevenue = selectedMonthRows.reduce(
        (total, month) => total + month.revenue,
        0
    );
    const selectedTotalOrders = selectedMonthRows.reduce(
        (total, month) => total + month.orders,
        0
    );
    const bestSelectedWeek = selectedMonthRows.reduce(
        (best, month) => {
            if ((month.bestWeek?.revenue || 0) > (best?.revenue || 0)) {
                return {
                    revenue: month.bestWeek.revenue,
                    orders: month.bestWeek.orders,
                    label: `${month.bestWeek.label} · ${month.label}`
                };
            }

            return best;
        },
        null
    );

    const comparisonDelta = primaryMonth && secondaryMonth
        ? ((primaryMonth.revenue - secondaryMonth.revenue) / Math.max(secondaryMonth.revenue || 1, 1)) * 100
        : null;

    const toggleMonth = key => {
        setSelectedMonths(current => {
            if (current.includes(key)) {
                return current.filter(item => item !== key);
            }

            if (current.length >= MONTH_COMPARE_LIMIT) {
                return [...current.slice(1), key];
            }

            return [...current, key];
        });
    };

    if (analyticsQuery.isLoading) {
        return (
            <section className="panel">
                <p>Cargando estadisticas...</p>
            </section>
        );
    }

    if (analyticsQuery.isError) {
        return (
            <section className="panel panel--error">
                <p>{analyticsQuery.error.message}</p>
            </section>
        );
    }

    if (!payload?.active_months?.length) {
        return (
            <EmptyState
                title="Sin ventas para analizar"
                description="Este modulo depende directamente del historial de ventas activas. Registra una venta o revisa el listado comercial."
                action={
                    <div className="page-actions">
                        <Link className="button button--primary" to="/sales/new">
                            <Plus size={16} />
                            Registrar venta
                        </Link>
                        <Link className="button button--ghost" to="/sales">
                            <ShoppingBag size={16} />
                            Ver ventas
                        </Link>
                    </div>
                }
            />
        );
    }

    return (
        <div className="analytics-page">
            <section className="analytics-shell">
                <header className="analytics-hero">
                    <div className="analytics-hero__title">
                        <span className="analytics-hero__icon">
                            <ChartColumnBig size={22} />
                        </span>
                        <div>
                            <p className="hero__eyebrow">Analitica comercial</p>
                            <h3>Mis Analiticas de Ventas</h3>
                            <p className="analytics-hero__copy">
                                Modulo conectado al historial de ventas activas. Compara meses,
                                identifica top servicios y revisa el comportamiento comercial del periodo.
                            </p>
                        </div>
                    </div>

                    <div className="analytics-controls">
                        <label className="analytics-control">
                            <span>📅</span>
                            <select value={year} onChange={event => setYear(event.target.value)}>
                                {payload.years.map(optionYear => (
                                    <option key={optionYear} value={String(optionYear)}>
                                        {optionYear}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="analytics-control">
                            <span>📈</span>
                            <select
                                value={chartStyle}
                                onChange={event => setChartStyle(event.target.value)}
                            >
                                <option value="area">Area</option>
                                <option value="line">Linea</option>
                            </select>
                        </label>

                        <div className="analytics-toggle">
                            <button
                                className={`analytics-toggle__button${
                                    granularity === 'monthly'
                                        ? ' analytics-toggle__button--active'
                                        : ''
                                }`}
                                onClick={() => setGranularity('monthly')}
                                type="button"
                            >
                                🗓️ Mensual
                            </button>
                            <button
                                className={`analytics-toggle__button${
                                    granularity === 'weekly'
                                        ? ' analytics-toggle__button--active'
                                        : ''
                                }`}
                                onClick={() => setGranularity('weekly')}
                                type="button"
                            >
                                📊 Semanal
                            </button>
                        </div>
                    </div>
                </header>

                <section className="page-actions">
                    <Link className="button button--primary" to="/sales/new">
                        <Plus size={16} />
                        Registrar venta
                    </Link>
                    <Link className="button button--ghost" to="/sales">
                        <ShoppingBag size={16} />
                        Ir a ventas
                    </Link>
                </section>

                <section className="analytics-chip-panel">
                    <span className="analytics-chip-panel__label">Comparar:</span>
                    <div className="analytics-chip-list">
                        {payload.active_months.map(month => {
                            const active = selectedMonths.includes(month.key);
                            const color = getMonthAccent(month);

                            return (
                                <button
                                    key={month.key}
                                    className={`analytics-chip${active ? ' analytics-chip--active' : ''}`}
                                    onClick={() => toggleMonth(month.key)}
                                    style={{
                                        '--chip-accent': color
                                    }}
                                    type="button"
                                >
                                    <span className="analytics-chip__dot" />
                                    {month.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="analytics-month-cards">
                    {selectedMonthRows.slice(0, 2).map(month => (
                        <article
                            className="analytics-month-card"
                            key={month.key}
                            style={{
                                '--card-accent': getMonthAccent(month)
                            }}
                        >
                            <p>{month.tag}</p>
                            <strong>{formatMoney(month.revenue)}</strong>
                            <span>
                                📦 {month.orders} ordenes · {month.bestWeek.label}
                            </span>
                        </article>
                    ))}
                </section>

                <article className="panel metrics-panel analytics-panel">
                    <div className="metrics-panel__header">
                        <div>
                            <h3>
                                {granularity === 'weekly'
                                    ? 'Comparativa semanal'
                                    : 'Tendencia de ventas'}
                            </h3>
                            <p className="metrics-panel__subtitle metrics-panel__subtitle--left">
                                {granularity === 'weekly'
                                    ? 'Semana a semana para los meses seleccionados.'
                                    : 'Comportamiento diario del mes seleccionado comparado contra los demas.'}
                            </p>
                        </div>
                        <div className="chart-legend">
                            {comparison.series.map(item => (
                                <span
                                    className="chart-legend__item analytics-legend-item"
                                    key={item.key}
                                    style={{
                                        '--legend-accent': item.color
                                    }}
                                >
                                    <span
                                        className="chart-legend__swatch"
                                        style={{ background: item.color }}
                                    />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>

                    <ComparisonChart
                        chartStyle={chartStyle}
                        granularity={granularity}
                        labels={comparison.labels}
                        series={comparison.series}
                    />
                </article>

                <section className="metrics-grid metrics-grid--split analytics-bottom-grid">
                    <article className="panel metrics-panel analytics-panel analytics-panel--split">
                        <div className="metrics-panel__header metrics-panel__header--stack">
                            <div>
                                <h3>
                                    Ventas por servicio <span>· {primaryMonth?.label || ''}</span>
                                </h3>
                            </div>
                        </div>

                        <div className="analytics-distribution">
                            <DonutChart items={primaryMonth?.breakdown || []} />

                            <div className="analytics-distribution__list">
                                {(primaryMonth?.breakdown || []).slice(0, 8).map(item => (
                                    <article className="analytics-list-card" key={item.name}>
                                        <div className="analytics-list-card__title">
                                            <span
                                                className="analytics-list-card__swatch"
                                                style={{ background: item.color }}
                                            />
                                            <strong>{item.name}</strong>
                                        </div>
                                        <span>{item.percentage.toFixed(1)}%</span>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </article>

                    <article className="panel metrics-panel analytics-panel analytics-panel--split">
                        <div className="metrics-panel__header metrics-panel__header--stack">
                            <div>
                                <h3>
                                    Top productos <span>· {primaryMonth?.label || ''}</span>
                                </h3>
                            </div>
                        </div>

                        <div className="analytics-rank-list">
                            {(primaryMonth?.breakdown || []).slice(0, 5).map((item, index) => (
                                <article className="analytics-rank-card" key={item.name}>
                                    <span
                                        className="analytics-rank-card__badge"
                                        style={{
                                            '--rank-accent': item.color
                                        }}
                                    >
                                        {index + 1}
                                    </span>
                                    <div className="analytics-rank-card__copy">
                                        <strong>{item.name}</strong>
                                        <small>{item.orders} ordenes registradas</small>
                                    </div>
                                    <strong className="analytics-rank-card__amount">
                                        {formatMoney(item.revenue)}
                                    </strong>
                                </article>
                            ))}
                        </div>
                    </article>
                </section>

                <section className="analytics-summary-grid">
                    <article className="analytics-summary-card analytics-summary-card--success">
                        <p>
                            <Trophy size={16} />
                            Mejor semana global
                        </p>
                        <strong>{formatMoney(bestSelectedWeek?.revenue || 0)}</strong>
                        <span>
                            {bestSelectedWeek?.label || 'Sin referencia'} · {bestSelectedWeek?.orders || 0}{' '}
                            ordenes
                        </span>
                    </article>

                    <article className="analytics-summary-card analytics-summary-card--primary">
                        <p>
                            <Package size={16} />
                            Total del periodo
                        </p>
                        <strong>{formatMoney(selectedTotalRevenue)}</strong>
                        <span>{selectedTotalOrders} ordenes · {selectedMonthRows.length} meses</span>
                    </article>

                    <article className="analytics-summary-card analytics-summary-card--accent">
                        <p>
                            <CalendarRange size={16} />
                            {primaryMonth && secondaryMonth
                                ? `${primaryMonth.label} vs ${secondaryMonth.label}`
                                : 'Comparativa'}
                        </p>
                        <strong>
                            {comparisonDelta === null
                                ? 'Sin segundo mes'
                                : `${comparisonDelta >= 0 ? '+' : ''}${comparisonDelta.toFixed(1)}%`}
                        </strong>
                        <span>
                            {primaryMonth
                                ? `${primaryMonth.label}: ${formatMoney(primaryMonth.revenue)}`
                                : 'Sin datos'}
                            {secondaryMonth
                                ? ` · ${secondaryMonth.label}: ${formatMoney(secondaryMonth.revenue)}`
                                : ''}
                        </span>
                    </article>
                </section>
            </section>
        </div>
    );
}
