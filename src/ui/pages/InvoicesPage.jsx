�import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../components/Toast';

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
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [draft, setDraft] = useState(normalizeInvoiceFilters({}));
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('date-desc');
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
    const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

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

    const mergeableVisibleInvoices = useMemo(
        () => visibleInvoices.filter(invoice => invoice.status === 'PENDIENTE'),
        [visibleInvoices]
    );

    const selectedInvoices = useMemo(
        () =>
            sortedInvoices
                .filter(invoice => selectedInvoiceIds.includes(invoice.id))
                .sort((left, right) => left.sequence_number - right.sequence_number),
        [selectedInvoiceIds, sortedInvoices]
    );

    const primaryInvoice = selectedInvoices[0] || null;
    const selectedClientIds = [...new Set(selectedInvoices.map(invoice => invoice.client_id))];
    const canMergeSelection =
        selectedInvoices.length >= 2 && selectedClientIds.length === 1;
    const allVisibleSelected =
        mergeableVisibleInvoices.length > 0 &&
        mergeableVisibleInvoices.every(invoice => selectedInvoiceIds.includes(invoice.id));

    useEffect(() => {
        const validIds = new Set(
            sortedInvoices
                .filter(invoice => invoice.status === 'PENDIENTE')
                .map(invoice => invoice.id)
        );

        setSelectedInvoiceIds(current => current.filter(id => validIds.has(id)));
    }, [sortedInvoices]);

    const mergeMutation = useMutation({
        mutationFn: invoiceIds =>
            apiFetch('/api/invoices/merge', {
                method: 'POST',
                body: { invoice_ids: invoiceIds }
            }),
        onSuccess: async payload => {
            const mergedInvoice = payload.data;

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['invoices'] }),
                queryClient.invalidateQueries({ queryKey: ['invoice'] }),
                queryClient.invalidateQueries({ queryKey: ['sales'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            ]);

            setSelectedInvoiceIds([]);
            setMergeDialogOpen(false);
            showToast(
                `Cuenta de cobro ${mergedInvoice.invoice_number} actualizada con las líneas unificadas`,
                'success'
            );
            navigate(`/invoices/${mergedInvoice.public_id}`);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const submitFilters = event => {
        event.preventDefault();
        setSearchParams(
            Object.fromEntries(
                Object.entries(draft).filter(([, value]) => String(value || '').trim())
            )
        );
    };

    const toggleInvoiceSelection = invoiceId => {
        setSelectedInvoiceIds(current =>
            current.includes(invoiceId)
                ? current.filter(id => id !== invoiceId)
                : [...current, invoiceId]
        );
    };

    const toggleVisibleSelection = () => {
        if (!mergeableVisibleInvoices.length) {
            return;
        }

        setSelectedInvoiceIds(current => {
            const visibleIds = mergeableVisibleInvoices.map(invoice => invoice.id);
            const everythingSelected = visibleIds.every(id => current.includes(id));

            if (everythingSelected) {
                return current.filter(id => !visibleIds.includes(id));
            }

            return [...new Set([...current, ...visibleIds])];
        });
    };

    const columns = [
        {
            key: 'select',
            label: (
                <input
                    aria-label="Selecciónar cuentas de cobro visibles"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    type="checkbox"
                />
            ),
            render: row => (
                <input
                    aria-label={`Selecciónar ${row.invoice_number}`}
                    checked={selectedInvoiceIds.includes(row.id)}
                    disabled={row.status !== 'PENDIENTE'}
                    onChange={() => toggleInvoiceSelection(row.id)}
                    type="checkbox"
                />
            )
        },
        { key: 'invoice_number', label: 'Cuenta de cobro' },
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
            label: 'Acciónes',
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
                        Nueva cuenta de cobro
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
                summary={`${visibleInvoices.length} de ${sortedInvoices.length} cuentas de cobro visibles`}
                helperText="Top y ordenamiento activo para todo el archivo de cuentas de cobro."
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

            {selectedInvoices.length ? (
                <section className="range-banner">
                    <div>
                        <strong>{selectedInvoices.length} cuentas de cobro selecciónadas</strong>
                        <p className="summary-note">
                            {selectedClientIds.length > 1
                                ? 'La selección actual mezcla clientes distintos. Elige solo cuentas de cobro del mismo cliente.'
                                : `Se conservará ${primaryInvoice?.invoice_number} y se moverán allí las líneas de las demás cuentas de cobro pendientes selecciónadas.`}
                        </p>
                    </div>

                    <div className="hero__actions">
                        <button
                            className="button button--ghost"
                            onClick={() => setSelectedInvoiceIds([])}
                            type="button"
                        >
                            Limpiar selección
                        </button>
                        <button
                            className="button button--primary"
                            disabled={!canMergeSelection}
                            onClick={() => setMergeDialogOpen(true)}
                            type="button"
                        >
                            Unificar cuentas de cobro
                        </button>
                    </div>
                </section>
            ) : null}

            {invoicesQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando cuentas de cobro...</p>
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
                            title="Todavía no hay cuentas de cobro"
                            description="Crea la primera cuenta de cobro PDF para consultar, descargar y marcar pagos."
                            action={
                                <Link className="button button--primary" to="/invoices/new">
                                    Crear cuenta de cobro
                                </Link>
                            }
                        />
                    }
                />
            )}

            <ConfirmDialog
                open={mergeDialogOpen}
                title="Unificar cuentas de cobro selecciónadas"
                description={
                    selectedInvoices.length < 2
                        ? 'Seleccióna al menos dos cuentas de cobro pendientes del mismo cliente.'
                        : selectedClientIds.length > 1
                            ? 'No puedes Unificar cuentas de cobro de clientes distintos.'
                        : `Se conservará ${primaryInvoice?.invoice_number} y se eliminarán ${selectedInvoices
                              .slice(1)
                              .map(invoice => invoice.invoice_number)
                              .join(', ')} después de mover sus líneas a la cuenta de cobro principal.`
                }
                confirmLabel={mergeMutation.isPending ? 'Unificando...' : 'Sí, unificar'}
                onCancel={() => setMergeDialogOpen(false)}
                onConfirm={() => mergeMutation.mutate(selectedInvoiceIds)}
                tone="primary"
            />
        </div>
    );
}
