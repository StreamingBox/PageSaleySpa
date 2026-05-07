import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Download, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import { applyVisibleLimit, compareDate, compareNumber, compareText } from '../lib/collections';
import {
    formatDate,
    formatMoney,
    getExportUrl,
    normalizeDashboardFilters
} from '../lib/format';
import CollectionToolbar from '../components/CollectionToolbar';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../components/Toast';

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

function sortSales(rows, sortValue) {
    const sorted = [...rows];

    switch (sortValue) {
        case 'date-asc':
            return sorted.sort((left, right) => compareDate(left.sold_at, right.sold_at));
        case 'total-desc':
            return sorted.sort((left, right) => compareNumber(right.price, left.price));
        case 'total-asc':
            return sorted.sort((left, right) => compareNumber(left.price, right.price));
        case 'client-asc':
            return sorted.sort((left, right) => compareText(left.client_name, right.client_name));
        case 'client-desc':
            return sorted.sort((left, right) => compareText(right.client_name, left.client_name));
        case 'date-desc':
        default:
            return sorted.sort((left, right) => compareDate(right.sold_at, left.sold_at));
    }
}

export default function SalesListPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [draft, setDraft] = useState({
        start: '',
        end: '',
        client_id: '',
        paid: ''
    });
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('date-desc');
    const [pendingDelete, setPendingDelete] = useState(null);

    const salesQuery = useQuery({
        queryKey: ['sales', location.search],
        queryFn: () => apiFetch(`/api/sales${location.search}`)
    });

    const clientsQuery = useQuery({
        queryKey: ['clients', 'options'],
        queryFn: () => apiFetch('/api/clients')
    });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setDraft(
            normalizeDashboardFilters({
                start: params.get('start') || '',
                end: params.get('end') || '',
                client_id: params.get('client_id') || '',
                paid: params.get('paid') || ''
            })
        );
    }, [location.search]);

    const clientFilterOptions = useMemo(
        () =>
            buildClientSelectOptions(clientsQuery.data?.data || [], {
                includeAll: true,
                allLabel: 'Todos los clientes',
                includeDescription: false
            }),
        [clientsQuery.data?.data]
    );

    const sortedSales = useMemo(
        () => sortSales(salesQuery.data?.data || [], sortValue),
        [salesQuery.data?.data, sortValue]
    );

    const visibleSales = useMemo(
        () => applyVisibleLimit(sortedSales, visibleLimit),
        [sortedSales, visibleLimit]
    );

    const deleteMutation = useMutation({
        mutationFn: id => apiFetch(`/api/sales/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['sales'] });
            showToast('Venta inactivada', 'success');
            setPendingDelete(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const columns = [
        { key: 'sold_at', label: 'Fecha', render: row => formatDate(row.sold_at) },
        { key: 'client_name', label: 'Cliente' },
        { key: 'product_name', label: 'Producto' },
        { key: 'quantity', label: 'Cantidad', align: 'right' },
        { key: 'unit_price', label: 'Unitario', render: row => formatMoney(row.unit_price) },
        { key: 'price', label: 'Total', render: row => formatMoney(row.price) },
        {
            key: 'invoice_number',
            label: 'Cuenta de cobro',
            render: row =>
                row.invoice_public_id ? (
                    <Link className="inline-link" to={`/invoices/${row.invoice_public_id}`}>
                        <FileText size={14} />
                        {row.invoice_number}
                    </Link>
                ) : (
                    'Sin cuenta de cobro'
                )
        },
        {
            key: 'paid',
            label: 'Estado',
            render: row => (
                <span className={`status-pill ${row.paid ? 'status-pill--success' : 'status-pill--warning'}`}>
                    {row.paid ? 'Pagado' : 'Pendiente'}
                </span>
            )
        },
        { key: 'payment_source', label: 'Origen' },
        {
            key: 'actions',
            label: 'AcciÃ³nes',
            align: 'right',
            render: row =>
                row.invoice_public_id ? (
                    <div className="table-action-group">
                        <button
                            className="table-action"
                            onClick={() => navigate(`/invoices/${row.invoice_public_id}`)}
                            type="button"
                        >
                            <FileText size={14} />
                            Ver cuenta de cobro
                        </button>
                    </div>
                ) : (
                    <div className="table-action-group">
                        <button
                            className="table-action"
                            onClick={() => navigate(`/sales/${row.id}/edit`)}
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
                            Inactivar
                        </button>
                    </div>
                )
        }
    ];

    const filters = salesQuery.data?.data
        ? {
              start: draft.start,
              end: draft.end,
              client_id: draft.client_id,
              paid: draft.paid
          }
        : draft;

    return (
        <div className="page-stack">
            <section className="page-actions">
                <Link className="button button--primary" to="/sales/new">
                    <Plus size={16} />
                    Registrar venta
                </Link>
                <Link className="button button--ghost" to="/analytics">
                    <BarChart3 size={16} />
                    Ver estadÃ­sticas
                </Link>
                <a className="button button--ghost" href={getExportUrl(filters)}>
                    <Download size={16} />
                    Exportar
                </a>
            </section>

            <form
                onSubmit={event => {
                    event.preventDefault();
                    const params = new URLSearchParams();
                    Object.entries(draft).forEach(([key, value]) => {
                        if (value) params.set(key, value);
                    });
                    navigate(`/sales${params.toString() ? `?${params}` : ''}`);
                }}
            >
                <FilterBar
                    actions={
                        <>
                            <button className="button button--primary" type="submit">
                                Filtrar
                            </button>
                            <button
                                className="button button--ghost"
                                onClick={() => navigate('/sales')}
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
                            options={clientFilterOptions}
                            placeholder="Todos los clientes"
                            searchPlaceholder="Busca por nombre, telÃ©fono o direcciÃ³n"
                            emptyMessage="No encontrÃ© clientes con ese filtro."
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
                            emptyMessage="No encontrÃ© estados con ese filtro."
                            onChange={nextValue =>
                                setDraft(current => ({ ...current, paid: nextValue }))
                            }
                        />
                    </label>
                </FilterBar>
            </form>

            <CollectionToolbar
                summary={`${visibleSales.length} de ${sortedSales.length} ventas visibles`}
                helperText="El historial comercial muestra tambiÃ©n la cuenta de cobro vinculada cuando exista."
                sortValue={sortValue}
                onSortChange={setSortValue}
                sortOptions={[
                    { value: 'date-desc', label: 'Fecha mÃ¡s reciente' },
                    { value: 'date-asc', label: 'Fecha mÃ¡s antigua' },
                    { value: 'total-desc', label: 'Total mayor a menor' },
                    { value: 'total-asc', label: 'Total menor a mayor' },
                    { value: 'client-asc', label: 'Cliente A-Z' },
                    { value: 'client-desc', label: 'Cliente Z-A' }
                ]}
                limitValue={visibleLimit}
                onLimitChange={setVisibleLimit}
            />

            {salesQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando ventas...</p>
                </section>
            ) : salesQuery.isError ? (
                <section className="panel panel--error">
                    <p>{salesQuery.error.message}</p>
                </section>
            ) : (
                <DataTable
                    columns={columns}
                    rows={visibleSales}
                    rowKey="id"
                    empty={
                        <EmptyState
                            title="AÃºn no hay ventas"
                            description="Registra la primera venta para activar mÃ©tricas y exportaciÃ³n."
                        />
                    }
                />
            )}

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                title="Inactivar venta"
                description={`La venta de ${pendingDelete?.client_name || ''} quedarÃ¡ fuera del listado activo.`}
                confirmLabel={deleteMutation.isPending ? 'Inactivando...' : 'Inactivar'}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
            />
        </div>
    );
}
