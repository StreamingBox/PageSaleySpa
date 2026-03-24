import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import CollectionToolbar from '../components/CollectionToolbar';
import { formatDate, formatMoney } from '../lib/format';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

function buildMovementQuery({ start = '', end = '', page = '', pageSize = '5', sort = 'date-desc' }) {
    const params = new URLSearchParams();

    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (page) params.set('page', page);
    if (pageSize) params.set('pageSize', pageSize);
    if (sort) params.set('sort', sort);

    const query = params.toString();
    return query ? `?${query}` : '';
}

export default function MovementsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const currentParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const pageSize = currentParams.get('pageSize') || '5';
    const sortValue = currentParams.get('sort') || 'date-desc';
    const currentPage = currentParams.get('page') || '';
    const [draft, setDraft] = useState({
        start: currentParams.get('start') || '',
        end: currentParams.get('end') || ''
    });
    const [pendingDelete, setPendingDelete] = useState(null);

    useEffect(() => {
        setDraft({
            start: currentParams.get('start') || '',
            end: currentParams.get('end') || ''
        });
    }, [currentParams]);

    useEffect(() => {
        if (currentParams.get('pageSize') && currentParams.get('sort')) {
            return;
        }

        navigate(
            `/movements${buildMovementQuery({
                start: currentParams.get('start') || '',
                end: currentParams.get('end') || '',
                page: currentPage,
                pageSize,
                sort: sortValue
            })}`,
            { replace: true }
        );
    }, [currentPage, currentParams, navigate, pageSize, sortValue]);

    const movementsQuery = useQuery({
        queryKey: ['movements', location.search],
        queryFn: () => apiFetch(`/api/movements${location.search}`)
    });

    const deleteMutation = useMutation({
        mutationFn: id => apiFetch(`/api/movements/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['movements'] });
            showToast('Movimiento eliminado', 'success');
            setPendingDelete(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const payload = movementsQuery.data;

    const updateListing = overrides => {
        navigate(
            `/movements${buildMovementQuery({
                start: overrides.start ?? draft.start,
                end: overrides.end ?? draft.end,
                page: overrides.page ?? '',
                pageSize: overrides.pageSize ?? pageSize,
                sort: overrides.sort ?? sortValue
            })}`
        );
    };

    return (
        <div className="page-stack">
            <section className="page-actions">
                <Link className="button button--primary" to="/movements/new">
                    <Plus size={16} />
                    Nuevo movimiento
                </Link>
            </section>

            <form
                onSubmit={event => {
                    event.preventDefault();
                    updateListing({ page: '' });
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
                                onClick={() => navigate(`/movements${buildMovementQuery({ pageSize, sort: sortValue })}`)}
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
                </FilterBar>
            </form>

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
                    <CollectionToolbar
                        summary={`${payload.data.length} de ${payload.meta.total} movimientos visibles`}
                        helperText="El top y el ordenamiento trabajan sobre la consulta completa."
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
                                        <a className="inline-link" href={row.attachment_url} target="_blank" rel="noreferrer">
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
