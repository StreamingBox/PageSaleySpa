import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Search } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import { applyVisibleLimit, compareDate, compareNumber, compareText } from '../lib/collections';
import {
    formatDate,
    formatMoney,
    getInvoicePdfUrl,
    normalizeInvoiceFilters
} from '../lib/format';
import CollectionToolbar from '../components/CollectionToolbar';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import SearchableSelect from '../components/SearchableSelect';

const statusOptions = [
    {
        value: '',
        label: 'Todos',
        searchText: 'todos'
    },
    {
        value: 'PENDIENTE',
        label: 'Pendiente',
        searchText: 'pendiente'
    },
    {
        value: 'PAGADA',
        label: 'Pagada',
        searchText: 'pagada'
    }
];

function sortInvoices(rows, sortValue) {
    const sorted = [...rows];

    switch (sortValue) {
        case 'date-asc':
            return sorted.sort((left, right) => compareDate(left.issue_date, right.issue_date));
        case 'total-desc':
            return sorted.sort((left, right) => compareNumber(right.total, left.total));
        case 'total-asc':
            return sorted.sort((left, right) => compareNumber(left.total, right.total));
        case 'number-asc':
            return sorted.sort((left, right) =>
                compareText(left.invoice_number, right.invoice_number)
            );
        case 'number-desc':
            return sorted.sort((left, right) =>
                compareText(right.invoice_number, left.invoice_number)
            );
        case 'client-asc':
            return sorted.sort((left, right) => compareText(left.client_name, right.client_name));
        case 'client-desc':
            return sorted.sort((left, right) =>
                compareText(right.client_name, left.client_name)
            );
        case 'date-desc':
        default:
            return sorted.sort((left, right) => compareDate(right.issue_date, left.issue_date));
    }
}

export default function InvoicesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [draft, setDraft] = useState(normalizeInvoiceFilters({}));
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('date-desc');

    const invoicesQuery = useQuery({
        queryKey: ['invoices', location.search],
        queryFn: () => apiFetch(`/api/invoices${location.search}`)
    });

    const clientsQuery = useQuery({
        queryKey: ['clients', 'invoice-options'],
        queryFn: () => apiFetch('/api/clients')
    });

    useEffect(() => {
        setDraft(
            normalizeInvoiceFilters({
                start: searchParams.get('start') || '',
                end: searchParams.get('end') || '',
                client_id: searchParams.get('client_id') || '',
                status: searchParams.get('status') || '',
                search: searchParams.get('search') || ''
            })
        );
    }, [searchParams]);

    const clientOptions = useMemo(
        () =>
            buildClientSelectOptions(clientsQuery.data?.data || [], {
                includeAll: true,
                allLabel: 'Todos los clientes',
                includeDescription: false
            }),
        [clientsQuery.data?.data]
    );

    const sortedInvoices = useMemo(
        () => sortInvoices(invoicesQuery.data?.data || [], sortValue),
        [invoicesQuery.data?.data, sortValue]
    );

    const visibleInvoices = useMemo(
        () => applyVisibleLimit(sortedInvoices, visibleLimit),
        [sortedInvoices, visibleLimit]
    );

    const submitFilters = event => {
        event.preventDefault();
        setSearchParams(
            Object.fromEntries(
                Object.entries(draft).filter(([, value]) => String(value || '').trim())
            )
        );
    };

    const columns = [
        { key: 'invoice_number', label: 'Factura' },
        { key: 'issue_date', label: 'Emisión', render: row => formatDate(row.issue_date) },
        { key: 'client_name', label: 'Cliente' },
        { key: 'lines_count', label: 'Items', align: 'right' },
        { key: 'total', label: 'Total', render: row => formatMoney(row.total) },
        {
            key: 'status',
            label: 'Estado',
            render: row => (
                <span
                    className={`status-pill ${
                        row.status === 'PAGADA' ? 'status-pill--success' : 'status-pill--warning'
                    }`}
                >
                    {row.status === 'PAGADA' ? 'Pagada' : 'Pendiente'}
                </span>
            )
        },
        {
            key: 'payment_source',
            label: 'Pago',
            render: row => (row.status === 'PAGADA' ? row.payment_source : 'Pendiente')
        },
        {
            key: 'actions',
            label: 'Acciones',
            align: 'right',
            render: row => (
                <div className="table-action-group">
                    <button
                        className="table-action"
                        onClick={() => navigate(`/invoices/${row.public_id}`)}
                        type="button"
                    >
                        <FileText size={14} />
                        Ver
                    </button>
                    <a
                        className="table-action"
                        href={getInvoicePdfUrl(row.public_id)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        PDF
                    </a>
                </div>
            )
        }
    ];

    return (
        <div className="page-stack">
            <form className="page-stack" onSubmit={submitFilters}>
                <section className="page-actions page-actions--clients">
                    <div className="search-bar">
                        <Search size={16} />
                        <input
                            placeholder="Buscar por número o cliente"
                            value={draft.search}
                            onChange={event =>
                                setDraft(current => ({ ...current, search: event.target.value }))
                            }
                        />
                        <button className="button button--ghost" type="submit">
                            Buscar
                        </button>
                    </div>

                    <Link className="button button--primary" to="/invoices/new">
                        <Plus size={16} />
                        Nueva factura
                    </Link>
                </section>

                <FilterBar
                    actions={
                        <>
                            <button className="button button--primary" type="submit">
                                Aplicar filtros
                            </button>
                            <button
                                className="button button--ghost"
                                onClick={() => navigate('/invoices')}
                                type="button"
                            >
                                Limpiar
                            </button>
                        </>
                    }
                >
                    <label className="field">
                        <span>Desde</span>
                        <input
                            type="date"
                            value={draft.start}
                            onChange={event =>
                                setDraft(current => ({ ...current, start: event.target.value }))
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
                            options={clientOptions}
                            placeholder="Todos los clientes"
                            searchPlaceholder="Busca por nombre o teléfono"
                            emptyMessage="No encontré clientes con ese filtro."
                            onChange={nextValue =>
                                setDraft(current => ({ ...current, client_id: nextValue }))
                            }
                        />
                    </label>

                    <label className="field">
                        <span>Estado</span>
                        <SearchableSelect
                            value={draft.status}
                            options={statusOptions}
                            placeholder="Todos"
                            searchPlaceholder="Busca un estado"
                            emptyMessage="No encontré estados con ese filtro."
                            onChange={nextValue =>
                                setDraft(current => ({ ...current, status: nextValue }))
                            }
                        />
                    </label>
                </FilterBar>
            </form>

            <CollectionToolbar
                summary={`${visibleInvoices.length} de ${sortedInvoices.length} facturas visibles`}
                helperText="Top y ordenamiento activo para todo el archivo de facturas."
                sortValue={sortValue}
                onSortChange={setSortValue}
                sortOptions={[
                    { value: 'date-desc', label: 'Fecha más reciente' },
                    { value: 'date-asc', label: 'Fecha más antigua' },
                    { value: 'number-desc', label: 'Número mayor a menor' },
                    { value: 'number-asc', label: 'Número menor a mayor' },
                    { value: 'total-desc', label: 'Total mayor a menor' },
                    { value: 'total-asc', label: 'Total menor a mayor' },
                    { value: 'client-asc', label: 'Cliente A-Z' },
                    { value: 'client-desc', label: 'Cliente Z-A' }
                ]}
                limitValue={visibleLimit}
                onLimitChange={setVisibleLimit}
            />

            {invoicesQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando facturas...</p>
                </section>
            ) : invoicesQuery.isError ? (
                <section className="panel panel--error">
                    <p>{invoicesQuery.error.message}</p>
                </section>
            ) : (
                <DataTable
                    columns={columns}
                    rows={visibleInvoices}
                    rowKey="id"
                    empty={
                        <EmptyState
                            title="Todavía no hay facturas"
                            description="Crea la primera factura PDF para consultar, descargar y marcar pagos."
                            action={
                                <Link className="button button--primary" to="/invoices/new">
                                    Crear factura
                                </Link>
                            }
                        />
                    }
                />
            )}
        </div>
    );
}
