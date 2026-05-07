import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { applyVisibleLimit, compareText } from '../lib/collections';
import CollectionToolbar from '../components/CollectionToolbar';
import DataTable from '../components/DataTable';
import DrawerForm from '../components/DrawerForm';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

const emptyCategory = { name: '' };

function sortCategories(rows, sortValue) {
    const sorted = [...rows];

    switch (sortValue) {
        case 'name-desc':
            return sorted.sort((left, right) => compareText(right.name, left.name));
        case 'name-asc':
        default:
            return sorted.sort((left, right) => compareText(left.name, right.name));
    }
}

export default function CategoriesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('name-asc');
    const [form, setForm] = useState(emptyCategory);
    const [pendingDelete, setPendingDelete] = useState(null);
    const newMatch = useMatch('/categories/new');
    const editMatch = useMatch('/categories/:id/edit');
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const listQuery = useQuery({
        queryKey: ['categories', location.search],
        queryFn: () => apiFetch(`/api/categories${location.search}`)
    });

    const editQuery = useQuery({
        queryKey: ['category', editMatch?.params.id],
        enabled: Boolean(editMatch?.params.id),
        queryFn: () => apiFetch(`/api/categories/${editMatch.params.id}`)
    });

    useEffect(() => {
        setDraftSearch(searchParams.get('search') || '');
    }, [searchParams]);

    useEffect(() => {
        if (newMatch) {
            setForm(emptyCategory);
            return;
        }

        if (editQuery.data?.data) {
            setForm({ name: editQuery.data.data.name });
        }
    }, [newMatch, editQuery.data]);

    const sortedCategories = useMemo(
        () => sortCategories(listQuery.data?.data || [], sortValue),
        [listQuery.data?.data, sortValue]
    );

    const visibleCategories = useMemo(
        () => applyVisibleLimit(sortedCategories, visibleLimit),
        [sortedCategories, visibleLimit]
    );

    const saveMutation = useMutation({
        mutationFn: values =>
            apiFetch(editMatch ? `/api/categories/${editMatch.params.id}` : '/api/categories', {
                method: editMatch ? 'PUT' : 'POST',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['categories'] });
            showToast(editMatch ? 'Categoría actualizada' : 'Categoría creada', 'success');
            navigate(`/categories${location.search}`);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const deleteMutation = useMutation({
        mutationFn: id => apiFetch(`/api/categories/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['categories'] });
            showToast('Categoría eliminada', 'success');
            setPendingDelete(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    return (
        <div className="page-stack">
            <section className="page-actions">
                <form
                    className="search-bar"
                    onSubmit={event => {
                        event.preventDefault();
                        setSearchParams(draftSearch ? { search: draftSearch } : {});
                    }}
                >
                    <Search size={16} />
                    <input
                        placeholder="Buscar categoría"
                        value={draftSearch}
                        onChange={event => setDraftSearch(event.target.value)}
                    />
                    <button className="button button--ghost" type="submit">
                        Buscar
                    </button>
                </form>

                <button className="button button--primary" onClick={() => navigate('/categories/new')} type="button">
                    <Plus size={16} />
                    Nueva categoría
                </button>
            </section>

            <CollectionToolbar
                summary={`${visibleCategories.length} de ${sortedCategories.length} categorías visibles`}
                helperText="Mantén el catálogo contable limpio con el mismo control visual."
                sortValue={sortValue}
                onSortChange={setSortValue}
                sortOptions={[
                    { value: 'name-asc', label: 'Nombre A-Z' },
                    { value: 'name-desc', label: 'Nombre Z-A' }
                ]}
                limitValue={visibleLimit}
                onLimitChange={setVisibleLimit}
            />

            {listQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando categorías...</p>
                </section>
            ) : listQuery.isError ? (
                <section className="panel panel--error">
                    <p>{listQuery.error.message}</p>
                </section>
            ) : (
                <DataTable
                    columns={[
                        { key: 'name', label: 'Nombre' },
                        {
                            key: 'actions',
                            label: 'Acciónes',
                            align: 'right',
                            render: row => (
                                <div className="table-action-group">
                                    <button
                                        className="table-action"
                                        onClick={() =>
                                            navigate(`/categories/${row.id}/edit${location.search}`)
                                        }
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
                    rows={visibleCategories}
                    rowKey="id"
                    empty={
                        <EmptyState
                            title="Sin categorías"
                            description="Crea categorías para que movimientos tenga una estructura consistente."
                        />
                    }
                />
            )}

            <DrawerForm
                open={Boolean(newMatch || editMatch)}
                title={editMatch ? 'Editar categoría' : 'Nueva categoría'}
                description="Mantén organizado el catálogo contable del negocio."
                onClose={() => navigate(`/categories${location.search}`)}
            >
                <form
                    className="stack-form"
                    onSubmit={event => {
                        event.preventDefault();
                        saveMutation.mutate(form);
                    }}
                >
                    <label className="field">
                        <span>Nombre</span>
                        <input
                            required
                            value={form.name}
                            onChange={event =>
                                setForm(current => ({ ...current, name: event.target.value }))
                            }
                        />
                    </label>

                    <button className="button button--primary" disabled={saveMutation.isPending} type="submit">
                        {saveMutation.isPending ? 'Guardando...' : editMatch ? 'Actualizar categoría' : 'Guardar categoría'}
                    </button>
                </form>
            </DrawerForm>

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                title="Eliminar categoría"
                description={`Esta acción quitará "${pendingDelete?.name || ''}" del catálogo.`}
                confirmLabel={deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
            />
        </div>
    );
}
