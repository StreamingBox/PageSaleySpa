import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    ArrowUpDown,
    Download,
    ExternalLink,
    FileText,
    MapPin,
    MessageCircle,
    Plus,
    Wallet
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import {
    formatDate,
    formatMoney,
    getExportUrl,
    normalizeDashboardFilters
} from '../lib/format';
import DrawerForm from '../components/DrawerForm';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import KpiCard from '../components/KpiCard';
import SearchableSelect from '../components/SearchableSelect';

const statusOptions = [
    {
        value: '',
        label: 'Todos',
        searchText: 'todos'
    },
    {
        value: '1',
        label: 'Pagado',
        searchText: 'pagado'
    },
    {
        value: '0',
        label: 'Pendiente',
        searchText: 'pendiente'
    }
];

function normalizeWhatsappPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');

    if (!digits) return '';
    if (digits.startsWith('57')) return digits;
    if (digits.length === 10) return `57${digits}`;
    return digits;
}

function buildWhatsappUrl(phone, name) {
    const whatsappPhone = normalizeWhatsappPhone(phone);
    if (!whatsappPhone) return '';

    const message = encodeURIComponent(
        `Hola ${name || ''}, te escribo desde SaleySpa.`
            .replace(/\s+/g, ' ')
            .trim()
    );

    return `https://wa.me/${whatsappPhone}?text=${message}`;
}

function buildInvoiceCreateUrl(clientId) {
    return `/invoices/new?client_id=${clientId}&select_all=1`;
}

export default function DashboardPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [draft, setDraft] = useState({
        start: '',
        end: '',
        client_id: '',
        paid: ''
    });
    const [debtSort, setDebtSort] = useState('desc');
    const [debtLimit, setDebtLimit] = useState('5');
    const [activeClient, setActiveClient] = useState(null);

    const dashboardQuery = useQuery({
        queryKey: ['dashboard', location.search],
        queryFn: () => apiFetch(`/api/dashboard${location.search}`)
    });
    const clientDetailQuery = useQuery({
        queryKey: ['dashboard-client', activeClient?.hash],
        enabled: Boolean(activeClient?.hash),
        queryFn: () => apiFetch(`/api/clients/${activeClient.hash}`)
    });

    const payload = dashboardQuery.data?.data;
    const filters = normalizeDashboardFilters(payload?.filters);

    useEffect(() => {
        setDraft(filters);
    }, [filters.start, filters.end, filters.client_id, filters.paid]);

    const clientFilterOptions = useMemo(
        () =>
            buildClientSelectOptions(payload?.clients || [], {
                includeAll: true,
                allLabel: 'Todos los clientes',
                includeDescription: false
            }),
        [payload?.clients]
    );

    const submitFilters = event => {
        event.preventDefault();
        const params = new URLSearchParams();

        Object.entries(draft).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        navigate(params.toString() ? `/?${params}` : '/');
    };

    if (dashboardQuery.isLoading) {
        return (
            <section className="panel">
                <p>Cargando resumen general...</p>
            </section>
        );
    }

    if (dashboardQuery.isError) {
        return (
            <section className="panel panel--error">
                <p>{dashboardQuery.error.message}</p>
            </section>
        );
    }

    const summary = payload.summary;
    const totalPendingDebt = payload.pendings.reduce(
        (total, item) => total + Number(item.debt || 0),
        0
    );
    const sortedPendings = [...payload.pendings].sort((left, right) =>
        debtSort === 'desc' ? right.debt - left.debt : left.debt - right.debt
    );
    const visiblePendings =
        debtLimit === 'all'
            ? sortedPendings
            : sortedPendings.slice(0, Number(debtLimit));
    const selectedClient = clientDetailQuery.data?.data || activeClient;
    const selectedClientWhatsapp = buildWhatsappUrl(
        selectedClient?.phone,
        selectedClient?.name
    );
    const selectedClientSalesUrl = selectedClient?.id
        ? `/sales?client_id=${selectedClient.id}`
        : '/sales';
    const selectedClientInvoiceUrl = selectedClient?.id
        ? buildInvoiceCreateUrl(selectedClient.id)
        : '/invoices/new';

    return (
        <>
            <div className="page-stack">
                <section className="hero">
                    <div>
                        <p className="hero__eyebrow">Bienestar diario</p>
                        <h3>Resumen general del spa</h3>
                        <p className="hero__text">
                            Rango activo del {formatDate(payload.currentRange.start)} al{' '}
                            {formatDate(payload.currentRange.end)}.
                        </p>
                    </div>

                    <div className="hero__actions">
                        <a className="button button--primary" href="/sales/new">
                            <Plus size={16} />
                            Nueva venta
                        </a>
                        <a className="button button--ghost" href="/movements/new">
                            <Wallet size={16} />
                            Nuevo movimiento
                        </a>
                    </div>
                </section>

                <form onSubmit={submitFilters}>
                    <FilterBar
                        actions={
                            <>
                                <button className="button button--primary" type="submit">
                                    Aplicar filtros
                                </button>
                                <a className="button button--ghost" href={getExportUrl(filters)}>
                                    <Download size={16} />
                                    Exportar Excel
                                </a>
                            </>
                        }
                    >
                        <label className="field">
                            <span>Desde</span>
                            <input
                                type="date"
                                value={draft.start}
                                onChange={event =>
                                    setDraft(current => ({
                                        ...current,
                                        start: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Hasta</span>
                            <input
                                type="date"
                                value={draft.end}
                                onChange={event =>
                                    setDraft(current => ({ ...current, end: event.target.value }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Cliente</span>
                            <SearchableSelect
                                value={draft.client_id}
                                options={clientFilterOptions}
                                placeholder="Todos los clientes"
                                searchPlaceholder="Busca por nombre, teléfono o dirección"
                                emptyMessage="No encontré clientes con ese filtro."
                                onChange={nextValue =>
                                    setDraft(current => ({
                                        ...current,
                                        client_id: nextValue
                                    }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Estado</span>
                            <SearchableSelect
                                value={draft.paid}
                                options={statusOptions}
                                placeholder="Todos"
                                searchPlaceholder="Busca un estado"
                                emptyMessage="No encontré estados con ese filtro."
                                onChange={nextValue =>
                                    setDraft(current => ({ ...current, paid: nextValue }))
                                }
                            />
                        </label>
                    </FilterBar>
                </form>

                <section className="kpi-grid">
                    <KpiCard
                        label="Ingreso actual"
                        value={formatMoney(summary.current.totalRevenue)}
                        note={`${summary.current.salesCount} ventas / ${summary.current.totalQuantity} unidades`}
                    />
                    <KpiCard
                        label="Periodo anterior"
                        value={formatMoney(summary.previous.totalRevenue)}
                        note={`${summary.previous.salesCount} ventas / ${summary.previous.totalQuantity} unidades`}
                        accent="cyan"
                    />
                    <KpiCard
                        label="Variación"
                        value={`${summary.revenuePct >= 0 ? '+' : ''}${summary.revenuePct.toFixed(1)}%`}
                        note={`Diferencia: ${formatMoney(summary.revenueDiff)}`}
                        accent={summary.revenuePct >= 0 ? 'success' : 'danger'}
                    />
                    <KpiCard
                        label="Total adeudado"
                        value={formatMoney(totalPendingDebt)}
                        note={`${sortedPendings.length} clientes con saldo pendiente`}
                        accent={totalPendingDebt > 0 ? 'warning' : 'success'}
                    />
                </section>

                <section className="panel">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Pendientes</p>
                            <h3>Clientes con saldo pendiente</h3>
                        </div>

                        <div className="debt-panel__actions">
                            <label className="debt-panel__sort">
                                <span className="debt-panel__label">Top</span>
                                <select
                                    value={debtLimit}
                                    onChange={event => setDebtLimit(event.target.value)}
                                >
                                    <option value="5">Top 5</option>
                                    <option value="10">Top 10</option>
                                    <option value="20">Top 20</option>
                                    <option value="30">Top 30</option>
                                    <option value="all">Todos</option>
                                </select>
                            </label>

                            <label className="debt-panel__sort">
                                <ArrowUpDown size={15} />
                                <select
                                    value={debtSort}
                                    onChange={event => setDebtSort(event.target.value)}
                                >
                                    <option value="desc">Mayor a menor</option>
                                    <option value="asc">Menor a mayor</option>
                                </select>
                            </label>

                            <a className="inline-link" href="/sales">
                                Ver ventas <ArrowRight size={14} />
                            </a>
                        </div>
                    </div>

                    {sortedPendings.length ? (
                        <div className="debt-table">
                            <div className="debt-table__head">
                                <span>Cliente</span>
                                <span>Contacto</span>
                                <span className="is-right">Saldo y acción</span>
                            </div>

                            <div className="debt-list">
                                {visiblePendings.map(item => {
                                    const whatsappUrl = buildWhatsappUrl(item.phone, item.name);

                                    return (
                                        <article className="debt-card" key={item.id}>
                                            <div className="debt-card__identity">
                                                <button
                                                    className="debt-card__name-button"
                                                    type="button"
                                                    onClick={() => setActiveClient(item)}
                                                >
                                                    {item.name}
                                                </button>
                                                <span>
                                                    {item.address ||
                                                        'Toca el nombre para ver los datos'}
                                                </span>
                                            </div>

                                            {whatsappUrl ? (
                                                <a
                                                    className="debt-card__phone-link"
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <MessageCircle size={16} />
                                                    {item.phone}
                                                    <ExternalLink size={14} />
                                                </a>
                                            ) : (
                                                <span className="debt-card__phone debt-card__phone--empty">
                                                    Sin teléfono
                                                </span>
                                            )}

                                            <div className="debt-card__summary">
                                                <strong className="debt-card__amount">
                                                    {formatMoney(item.debt)}
                                                </strong>
                                                <button
                                                    className="table-action"
                                                    type="button"
                                                    onClick={() =>
                                                        navigate(buildInvoiceCreateUrl(item.id))
                                                    }
                                                >
                                                    <FileText size={14} />
                                                    Generar factura
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            title="Sin deudas pendientes"
                            description="El flujo de cobro está al día para el rango actual."
                        />
                    )}
                </section>
            </div>

            <DrawerForm
                open={Boolean(activeClient)}
                title={selectedClient?.name || 'Cliente'}
                description="Datos rápidos del cliente con saldo pendiente."
                eyebrow="Cliente"
                onClose={() => setActiveClient(null)}
            >
                {selectedClient ? (
                    <div className="client-detail">
                        <div className="client-detail__grid">
                            <article className="client-detail__item">
                                <span className="client-detail__label">Nombre</span>
                                <strong className="client-detail__value">
                                    {selectedClient.name}
                                </strong>
                            </article>

                            <article className="client-detail__item">
                                <span className="client-detail__label">Teléfono</span>
                                <strong className="client-detail__value">
                                    {selectedClient.phone || 'Sin teléfono'}
                                </strong>
                            </article>

                            <article className="client-detail__item client-detail__item--full">
                                <span className="client-detail__label">Dirección</span>
                                <strong className="client-detail__value">
                                    {selectedClient.address || 'Sin dirección registrada'}
                                </strong>
                            </article>

                            <article className="client-detail__item client-detail__item--full">
                                <span className="client-detail__label">Saldo pendiente</span>
                                <strong className="client-detail__value client-detail__value--debt">
                                    {formatMoney(activeClient?.debt || 0)}
                                </strong>
                            </article>
                        </div>

                        {clientDetailQuery.isLoading ? (
                            <p className="client-detail__loading">
                                Cargando datos del cliente...
                            </p>
                        ) : null}

                        <div className="client-detail__actions">
                            {selectedClientWhatsapp ? (
                                <a
                                    className="button button--primary"
                                    href={selectedClientWhatsapp}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <MessageCircle size={16} />
                                    Abrir WhatsApp
                                </a>
                            ) : null}

                            <button
                                className="button button--ghost"
                                type="button"
                                onClick={() => navigate(selectedClientInvoiceUrl)}
                            >
                                <FileText size={16} />
                                Generar factura
                            </button>

                            <a
                                className="button button--ghost"
                                href={selectedClientSalesUrl}
                                onClick={() => setActiveClient(null)}
                            >
                                <ArrowRight size={16} />
                                Ver ventas
                            </a>
                        </div>

                        <div className="client-detail__meta">
                            <span>
                                <MapPin size={15} />
                                {selectedClient.address || 'Sin dirección'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="client-detail client-detail--loading">
                        <p>Selecciona un cliente para ver sus datos.</p>
                    </div>
                )}
            </DrawerForm>
        </>
    );
}
