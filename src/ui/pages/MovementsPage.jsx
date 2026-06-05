import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    ChartColumnBig,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    Scale,
    Trash2,
    Wallet
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import CollectionToolbar from '../components/CollectionToolbar';
import { formatDate, formatMoney, getMonthFromDate, getMonthRange } from '../lib/format';
import {
    cleanVisibleSearch,
    getRouteStateValues,
    readQueryValues
} from '../lib/cleanRouting';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import KpiCard from '../components/KpiCard';
import { useToast } from '../components/Toast';

const MOVEMENT_COLORS = {
    income: '#18a66f',
    expense: '#d7a56f',
    balance: '#5fd1c8',
    category: ['#a777cf', '#79cfcd', '#7db68d', '#d7a56f', '#d84f5f', '#8d84a0']
};
const MOVEMENT_MONTH_COLORS = [
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
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function buildMovementApiQuery({
    start = '',
    end = '',
    page = '1',
    pageSize = '5',
    sort = 'date-desc'
}) {
    const params = new URLSearchParams();

    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (page) params.set('page', page);
    if (pageSize) params.set('pageSize', pageSize);
    if (sort) params.set('sort', sort);

    const query = params.toString();
    return query ? `?${query}` : '';
}

function formatCompactMoney(value) {
    const number = Number(value || 0);
    const sign = number < 0 ? '-' : '';
    const absolute = Math.abs(number);

    if (absolute >= 1000000) {
        return `${sign}$${(absolute / 1000000).toFixed(1)}M`;
    }

    if (absolute >= 1000) {
        return `${sign}$${Math.round(absolute / 1000)}K`;
    }

    return formatMoney(number);
}

function formatShortDate(value) {
    const [year, month, day] = String(value || '').split('-');

    if (!year || !month || !day) {
        return value || '';
    }

    return `${day}/${month}`;
}

function getInitialMovementMonth(location) {
    const queryValues = readQueryValues(location.search, ['month', 'start', 'end']);
    const stateValues = getRouteStateValues(location);
    const month = stateValues.month || queryValues.month || '';

    if (month) {
        return month;
    }

    const startMonth = getMonthFromDate(queryValues.start);
    const endMonth = getMonthFromDate(queryValues.end);

    if (startMonth && (!endMonth || startMonth === endMonth)) {
        return startMonth;
    }

    return '';
}

function getMonthLabel(monthKey) {
    const [year, month] = String(monthKey || '').split('-');
    const monthIndex = Number(month) - 1;

    if (!year || monthIndex < 0 || monthIndex >= MONTH_LABELS.length) {
        return monthKey || '';
    }

    return `${MONTH_LABELS[monthIndex]} de ${year}`;
}

function getMonthAccent(monthKey) {
    const [, month] = String(monthKey || '').split('-');
    const monthIndex = Math.max(0, Number(month) - 1);

    return MOVEMENT_MONTH_COLORS[monthIndex % MOVEMENT_MONTH_COLORS.length] || MOVEMENT_MONTH_COLORS[0];
}

function buildMovementMonthOptions(selectedMonth) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const months = new Set(
        Array.from({ length: now.getMonth() + 1 }, (_, index) =>
            `${currentYear}-${String(index + 1).padStart(2, '0')}`
        )
    );

    if (selectedMonth) {
        months.add(selectedMonth);
    }

    return Array.from(months)
        .sort()
        .map(key => ({
            key,
            label: getMonthLabel(key),
            accent: getMonthAccent(key)
        }));
}

function buildLinePath(values, maxValue, width, height, tension = 0.22) {
    if (!values.length) return '';
    const stepX = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((value, index) => ({
        x: index * stepX,
        y: height - (Number(value || 0) / maxValue) * height
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

function buildMovementInsights(rows) {
    const days = new Map();
    const categories = new Map();
    const paymentTypes = new Map();
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    rows.forEach(row => {
        const amount = Number(row.amount || 0);
        const isIncome = row.type === 'ingreso';
        const dateKey = row.date || 'Sin fecha';
        const categoryKey = String(row.category || 'Sin categoría').trim() || 'Sin categoría';
        const paymentKey = String(row.payment_type || 'Sin pago').trim() || 'Sin pago';

        if (!days.has(dateKey)) {
            days.set(dateKey, { date: dateKey, income: 0, expense: 0 });
        }

        if (!categories.has(categoryKey)) {
            categories.set(categoryKey, {
                label: categoryKey,
                income: 0,
                expense: 0,
                total: 0,
                count: 0
            });
        }

        if (!paymentTypes.has(paymentKey)) {
            paymentTypes.set(paymentKey, {
                label: paymentKey,
                income: 0,
                expense: 0,
                total: 0,
                count: 0
            });
        }

        const day = days.get(dateKey);
        const category = categories.get(categoryKey);
        const payment = paymentTypes.get(paymentKey);

        if (isIncome) {
            income += amount;
            incomeCount += 1;
            day.income += amount;
            category.income += amount;
            payment.income += amount;
        } else {
            expense += amount;
            expenseCount += 1;
            day.expense += amount;
            category.expense += amount;
            payment.expense += amount;
        }

        category.total += amount;
        category.count += 1;
        payment.total += amount;
        payment.count += 1;
    });

    const addPercentages = items => {
        const max = Math.max(...items.map(item => item.total), 1);

        return items.map((item, index) => ({
            ...item,
            color: MOVEMENT_COLORS.category[index % MOVEMENT_COLORS.category.length],
            percentage: Math.max(4, (item.total / max) * 100)
        }));
    };

    const series = Array.from(days.values()).sort((left, right) =>
        String(left.date).localeCompare(String(right.date))
    );

    const byCategory = addPercentages(
        Array.from(categories.values()).sort((left, right) => right.total - left.total)
    ).slice(0, 6);

    const byPaymentType = addPercentages(
        Array.from(paymentTypes.values()).sort((left, right) => right.total - left.total)
    ).slice(0, 6);

    return {
        income,
        expense,
        balance: income - expense,
        incomeCount,
        expenseCount,
        count: rows.length,
        average: rows.length ? (income + expense) / rows.length : 0,
        series,
        byCategory,
        byPaymentType
    };
}

function MovementTrendChart({ series }) {
    const width = 1120;
    const height = 320;
    const plotWidth = width - 72;
    const plotHeight = height - 24;
    const gridSteps = 4;
    const incomeValues = series.map(day => day.income);
    const expenseValues = series.map(day => day.expense);
    const maxValue = Math.max(...incomeValues, ...expenseValues, 1);
    const labelStep = Math.max(1, Math.ceil(series.length / 6));

    if (!series.length) {
        return <p className="metric-empty">No hay movimientos para graficar en este rango.</p>;
    }

    return (
        <div className="chart-shell chart-shell--tall movement-chart-shell">
            <svg className="chart-svg" viewBox={`0 0 ${width} ${height + 58}`} role="img">
                {Array.from({ length: gridSteps + 1 }, (_, index) => {
                    const y = (plotHeight / gridSteps) * index;
                    const value = maxValue - (maxValue / gridSteps) * index;

                    return (
                        <g key={index}>
                            <line
                                className="chart-grid-line"
                                x1="64"
                                x2={width}
                                y1={y + 12}
                                y2={y + 12}
                            />
                            <text className="chart-axis-text" x="0" y={y + 17}>
                                {formatCompactMoney(value)}
                            </text>
                        </g>
                    );
                })}

                <g transform="translate(64 12)">
                    <path
                        d={buildAreaPath(incomeValues, maxValue, plotWidth, plotHeight)}
                        fill={MOVEMENT_COLORS.income}
                        fillOpacity="0.12"
                        stroke="none"
                    />
                    <path
                        d={buildAreaPath(expenseValues, maxValue, plotWidth, plotHeight)}
                        fill={MOVEMENT_COLORS.expense}
                        fillOpacity="0.12"
                        stroke="none"
                    />
                    <path
                        d={buildLinePath(incomeValues, maxValue, plotWidth, plotHeight)}
                        fill="none"
                        stroke={MOVEMENT_COLORS.income}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="4"
                    />
                    <path
                        d={buildLinePath(expenseValues, maxValue, plotWidth, plotHeight)}
                        fill="none"
                        stroke={MOVEMENT_COLORS.expense}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="4"
                    />
                    {series.length === 1 ? (
                        <>
                            <circle
                                className="chart-point"
                                cx="0"
                                cy={plotHeight - (incomeValues[0] / maxValue) * plotHeight}
                                fill={MOVEMENT_COLORS.income}
                                r="6"
                            />
                            <circle
                                className="chart-point"
                                cx="0"
                                cy={plotHeight - (expenseValues[0] / maxValue) * plotHeight}
                                fill={MOVEMENT_COLORS.expense}
                                r="6"
                            />
                        </>
                    ) : null}
                </g>

                {series.map((day, index) => {
                    const isVisibleLabel =
                        index === 0 || index === series.length - 1 || index % labelStep === 0;
                    const x =
                        64 +
                        (series.length > 1
                            ? (plotWidth / (series.length - 1)) * index
                            : 0);

                    return isVisibleLabel ? (
                        <text
                            key={`${day.date}-${index}`}
                            className="chart-axis-value"
                            textAnchor={
                                index === 0
                                    ? 'start'
                                    : index === series.length - 1
                                      ? 'end'
                                      : 'middle'
                            }
                            x={x}
                            y={height + 42}
                        >
                            {formatShortDate(day.date)}
                        </text>
                    ) : null;
                })}
            </svg>

            <div className="chart-legend">
                <span className="chart-legend__item movement-legend-item">
                    <span
                        className="chart-legend__swatch"
                        style={{ background: MOVEMENT_COLORS.income }}
                    />
                    Ingresos
                </span>
                <span className="chart-legend__item movement-legend-item">
                    <span
                        className="chart-legend__swatch"
                        style={{ background: MOVEMENT_COLORS.expense }}
                    />
                    Gastos
                </span>
            </div>
        </div>
    );
}

function MovementBars({ items, emptyText }) {
    if (!items.length) {
        return <p className="metric-empty">{emptyText}</p>;
    }

    return (
        <div className="movement-bars">
            {items.map(item => (
                <article className="movement-bar-row" key={item.label}>
                    <div className="movement-bar-row__head">
                        <div>
                            <strong>{item.label}</strong>
                            <span>
                                {item.count} movimientos · {formatMoney(item.income)} ingresos ·{' '}
                                {formatMoney(item.expense)} gastos
                            </span>
                        </div>
                        <b>{formatMoney(item.total)}</b>
                    </div>
                    <div className="movement-bar-row__track">
                        <span
                            className="movement-bar-row__fill"
                            style={{ width: `${item.percentage}%`, background: item.color }}
                        />
                    </div>
                </article>
            ))}
        </div>
    );
}

function MovementInsights({ insights, loading, error }) {
    if (loading) {
        return (
            <section className="panel">
                <p>Preparando gráficas de movimientos...</p>
            </section>
        );
    }

    if (error) {
        return (
            <section className="panel panel--error">
                <p>No se pudo cargar la graficación de movimientos.</p>
            </section>
        );
    }

    return (
        <section className="movement-insights">
            <div className="kpi-grid movement-kpi-grid">
                <KpiCard
                    label="Ingresos"
                    value={formatMoney(insights.income)}
                    note={`${insights.incomeCount} movimientos registrados`}
                    accent="success"
                />
                <KpiCard
                    label="Gastos"
                    value={formatMoney(insights.expense)}
                    note={`${insights.expenseCount} movimientos registrados`}
                    accent="warning"
                />
                <KpiCard
                    label="Balance"
                    value={formatMoney(insights.balance)}
                    note="Ingresos menos gastos"
                    accent={insights.balance < 0 ? 'danger' : 'cyan'}
                    valueTag={`${insights.count} mov.`}
                />
                <KpiCard
                    label="Promedio"
                    value={formatMoney(insights.average)}
                    note="Valor medio por movimiento"
                    accent="indigo"
                />
            </div>

            <section className="metrics-panel movement-panel">
                <div className="metrics-panel__header">
                    <div>
                        <span className="movement-panel__eyebrow">
                            <ChartColumnBig size={15} />
                            Movimientos
                        </span>
                        <h3>Evolución de ingresos y gastos</h3>
                    </div>
                    <p className="metrics-panel__subtitle">
                        {insights.series.length} días con movimientos en el rango actual.
                    </p>
                </div>
                <MovementTrendChart series={insights.series} />
            </section>

            <section className="movement-chart-grid">
                <article className="metrics-panel movement-panel">
                    <div className="metrics-panel__header metrics-panel__header--stack">
                        <span className="movement-panel__eyebrow">
                            <Wallet size={15} />
                            Categorías
                        </span>
                        <h3>Categorías con más movimiento</h3>
                    </div>
                    <MovementBars
                        items={insights.byCategory}
                        emptyText="No hay categorías para mostrar."
                    />
                </article>

                <article className="metrics-panel movement-panel">
                    <div className="metrics-panel__header metrics-panel__header--stack">
                        <span className="movement-panel__eyebrow">
                            <Scale size={15} />
                            Resumen
                        </span>
                        <h3>Lectura rápida del flujo</h3>
                    </div>
                    <div className="movement-flow-summary">
                        <div className="movement-flow-summary__item">
                            <ArrowUpCircle size={22} />
                            <span>Ingresos</span>
                            <strong>{formatMoney(insights.income)}</strong>
                        </div>
                        <div className="movement-flow-summary__item">
                            <ArrowDownCircle size={22} />
                            <span>Gastos</span>
                            <strong>{formatMoney(insights.expense)}</strong>
                        </div>
                        <div className="movement-flow-summary__item movement-flow-summary__item--balance">
                            <Scale size={22} />
                            <span>Balance</span>
                            <strong>{formatMoney(insights.balance)}</strong>
                        </div>
                    </div>
                    <MovementBars
                        items={insights.byPaymentType}
                        emptyText="No hay medios de pago para mostrar."
                    />
                </article>
            </section>
        </section>
    );
}

export default function MovementsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const initialMonth = useMemo(() => getInitialMovementMonth(location), []);
    const [monthFilter, setMonthFilter] = useState(initialMonth);
    const activeMonthRange = useMemo(
        () => getMonthRange(monthFilter),
        [monthFilter]
    );
    const [pageSize, setPageSize] = useState('5');
    const [sortValue, setSortValue] = useState('date-desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        cleanVisibleSearch(location, navigate);
    }, [location, navigate]);

    const listingQuery = useMemo(
        () =>
            buildMovementApiQuery({
                start: activeMonthRange.start,
                end: activeMonthRange.end,
                page: String(currentPage),
                pageSize,
                sort: sortValue
            }),
        [activeMonthRange.end, activeMonthRange.start, currentPage, pageSize, sortValue]
    );
    const insightsQueryString = useMemo(
        () =>
            buildMovementApiQuery({
                start: activeMonthRange.start,
                end: activeMonthRange.end,
                page: '1',
                pageSize: 'all',
                sort: 'date-asc'
            }),
        [activeMonthRange.end, activeMonthRange.start]
    );

    const movementsQuery = useQuery({
        queryKey: ['movements', listingQuery],
        queryFn: () => apiFetch(`/api/movements${listingQuery}`)
    });

    const insightsQuery = useQuery({
        queryKey: ['movements-insights', insightsQueryString],
        queryFn: () => apiFetch(`/api/movements${insightsQueryString}`)
    });

    const deleteMutation = useMutation({
        mutationFn: id => apiFetch(`/api/movements/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['movements'] });
            await queryClient.invalidateQueries({ queryKey: ['movements-insights'] });
            showToast('Movimiento eliminado', 'success');
            setPendingDelete(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const payload = movementsQuery.data;
    const insights = useMemo(
        () => buildMovementInsights(insightsQuery.data?.data || []),
        [insightsQuery.data]
    );
    const monthOptions = useMemo(
        () => buildMovementMonthOptions(monthFilter),
        [monthFilter]
    );

    useEffect(() => {
        if (payload?.meta && currentPage > payload.meta.totalPages) {
            setCurrentPage(payload.meta.totalPages);
        }
    }, [currentPage, payload?.meta]);

    const selectMonth = nextMonth => {
        setMonthFilter(nextMonth);
        setCurrentPage(1);
    };

    const updateListing = overrides => {
        if (overrides.sort !== undefined) {
            setSortValue(overrides.sort);
        }

        if (overrides.pageSize !== undefined) {
            setPageSize(overrides.pageSize);
        }

        if (overrides.page !== undefined && overrides.page !== '') {
            setCurrentPage(Math.max(1, Number(overrides.page) || 1));
            return;
        }

        setCurrentPage(1);
    };

    return (
        <div className="page-stack">
            <section className="page-actions">
                <Link className="button button--primary" to="/movements/new">
                    <Plus size={16} />
                    Nuevo movimiento
                </Link>
            </section>

            <section className="analytics-chip-panel movement-month-panel">
                <span className="analytics-chip-panel__label">Mes:</span>
                <div className="analytics-chip-list">
                    <button
                        className={`analytics-chip${!monthFilter ? ' analytics-chip--active' : ''}`}
                        onClick={() => selectMonth('')}
                        style={{ '--chip-accent': MOVEMENT_COLORS.balance }}
                        type="button"
                    >
                        <span className="analytics-chip__dot" />
                        Todos
                    </button>
                    {monthOptions.map(month => (
                        <button
                            key={month.key}
                            className={`analytics-chip${
                                monthFilter === month.key ? ' analytics-chip--active' : ''
                            }`}
                            onClick={() => selectMonth(month.key)}
                            style={{ '--chip-accent': month.accent }}
                            type="button"
                        >
                            <span className="analytics-chip__dot" />
                            {month.label}
                        </button>
                    ))}
                </div>
            </section>

            {movementsQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando movimientos...</p>
                </section>
            ) : movementsQuery.isError ? (
                <section className="panel panel--error">
                    <p>{movementsQuery.error.message}</p>
                </section>
            ) : (
                <>
                    <MovementInsights
                        insights={insights}
                        loading={insightsQuery.isLoading}
                        error={insightsQuery.isError}
                    />

                    <CollectionToolbar
                        summary={`${payload.data.length} de ${payload.meta.total} movimientos visibles`}
                        helperText="El orden y el top se aplican a la tabla de movimientos."
                        sortValue={sortValue}
                        onSortChange={nextSort => updateListing({ sort: nextSort, page: '' })}
                        sortOptions={[
                            { value: 'date-desc', label: 'Fecha más reciente' },
                            { value: 'date-asc', label: 'Fecha más antigua' },
                            { value: 'amount-desc', label: 'Monto mayor a menor' },
                            { value: 'amount-asc', label: 'Monto menor a mayor' },
                            { value: 'category-asc', label: 'Categoría A-Z' },
                            { value: 'category-desc', label: 'Categoría Z-A' }
                        ]}
                        limitValue={pageSize}
                        onLimitChange={nextLimit => updateListing({ pageSize: nextLimit, page: '' })}
                    />

                    <DataTable
                        columns={[
                            { key: 'date', label: 'Fecha', render: row => formatDate(row.date) },
                            {
                                key: 'type',
                                label: 'Tipo',
                                render: row => (
                                    <span
                                        className={`status-pill ${
                                            row.type === 'ingreso'
                                                ? 'status-pill--success'
                                                : 'status-pill--warning'
                                        }`}
                                    >
                                        {row.type}
                                    </span>
                                )
                            },
                            { key: 'amount', label: 'Monto', render: row => formatMoney(row.amount) },
                            { key: 'payment_type', label: 'Pago' },
                            { key: 'category', label: 'Categoría' },
                            { key: 'description', label: 'Descripción' },
                            {
                                key: 'attachment',
                                label: 'Adjunto',
                                render: row =>
                                    row.attachment ? (
                                        <a
                                            className="inline-link"
                                            href={row.attachment_url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Ver archivo
                                        </a>
                                    ) : (
                                        'Sin adjunto'
                                    )
                            },
                            {
                                key: 'actions',
                                label: 'Acciones',
                                align: 'right',
                                render: row => (
                                    <div className="table-action-group">
                                        <button
                                            className="table-action"
                                            onClick={() => navigate(`/movements/${row.id}/edit`)}
                                            type="button"
                                        >
                                            <Pencil size={14} />
                                            Editar
                                        </button>
                                        <button
                                            className="table-action table-action--danger"
                                            onClick={() => setPendingDelete(row)}
                                            type="button"
                                        >
                                            <Trash2 size={14} />
                                            Borrar
                                        </button>
                                    </div>
                                )
                            }
                        ]}
                        rows={payload.data}
                        rowKey="id"
                        empty={
                            <EmptyState
                                title="Sin movimientos"
                                description="Todavía no hay ingresos o gastos cargados en este rango."
                            />
                        }
                    />

                    <section className="pagination-bar">
                        <span>
                            Página {payload.meta.page} de {payload.meta.totalPages}
                        </span>
                        <div className="pagination-bar__actions">
                            <button
                                className="button button--ghost"
                                disabled={payload.meta.page <= 1}
                                onClick={() => updateListing({ page: String(payload.meta.page - 1) })}
                                type="button"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>
                            <button
                                className="button button--ghost"
                                disabled={payload.meta.page >= payload.meta.totalPages}
                                onClick={() => updateListing({ page: String(payload.meta.page + 1) })}
                                type="button"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </section>
                </>
            )}

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                title="Eliminar movimiento"
                description={`Eliminarás el movimiento de ${pendingDelete ? formatMoney(pendingDelete.amount) : ''}.`}
                confirmLabel={deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
            />
        </div>
    );
}
