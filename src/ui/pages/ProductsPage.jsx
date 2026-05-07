import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { applyVisibleLimit, compareNumber, compareText } from '../lib/collections';
import { formatMoney } from '../lib/format';
import CollectionToolbar from '../components/CollectionToolbar';
import DataTable from '../components/DataTable';
import DrawerForm from '../components/DrawerForm';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';

const emptyProduct = {
    name: '',
    price: '',
    duration_minutes: '60'
};

function sortProducts(rows, sortValue) {
    const sorted = [...rows];

    switch (sortValue) {
        case 'name-desc':
            return sorted.sort((left, right) => compareText(right.name, left.name));
        case 'price-desc':
            return sorted.sort((left, right) => compareNumber(right.price, left.price));
        case 'price-asc':
            return sorted.sort((left, right) => compareNumber(left.price, right.price));
        case 'name-asc':
        default:
            return sorted.sort((left, right) => compareText(left.name, right.name));
    }
}

export default function ProductsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('name-asc');
    const [form, setForm] = useState(emptyProduct);
    const newMatch = useMatch('/products/new');
    const editMatch = useMatch('/products/:hash/edit');
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const listQuery = useQuery({
        queryKey: ['products', location.search],
        queryFn: () => apiFetch(`/api/products${location.search}`)
    });

    const editQuery = useQuery({
        queryKey: ['product', editMatch?.params.hash],
        enabled: Boolean(editMatch?.params.hash),
        queryFn: () => apiFetch(`/api/products/${editMatch.params.hash}`)
    });

    useEffect(() => {
        setDraftSearch(searchParams.get('search') || '');
    }, [searchParams]);

    useEffect(() => {
        if (newMatch) {
            setForm(emptyProduct);
            return;
        }

        if (editQuery.data?.data) {
            setForm({
                name: editQuery.data.data.name,
                price: editQuery.data.data.price,
                duration_minutes: editQuery.data.data.duration_minutes || 60
            });
        }
    }, [newMatch, editQuery.data]);

    const sortedProducts = useMemo(
        () => sortProducts(listQuery.data?.data || [], sortValue),
        [listQuery.data?.data, sortValue]
    );

    const visibleProducts = useMemo(
        () => applyVisibleLimit(sortedProducts, visibleLimit),
        [sortedProducts, visibleLimit]
    );

    const saveMutation = useMutation({
        mutationFn: values =>
            apiFetch(editMatch ? `/api/products/${editMatch.params.hash}` : '/api/products', {
                method: editMatch ? 'PUT' : 'POST',
                body: {
                    ...values,
                    price: Number(values.price),
                    duration_minutes: Number(values.duration_minutes)
                }
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['products'] });
            showToast(editMatch ? 'Producto actualizado' : 'Producto creado', 'success');
            navigate(`/products${location.search}`);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const columns = [
        { key: 'name', label: 'Producto / servicio' },
        {
            key: 'price',
            label: 'Precio',
            render: row => formatMoney(row.price)
        },
        {
            key: 'duration_minutes',
            label: 'Duración',
            render: row => `${row.duration_minutes} min`
        },
        {
            key: 'actions',
            label: 'Acciónes',
            align: 'right',
            render: row => (
                <button
                    className="table-action"
                    onClick={() => navigate(`/products/${row.hash}/edit${location.search}`)}
                    type="button"
                >
                    <Pencil size={14} />
                    Editar
                </button>
            )
        }
    ];

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
                        placeholder="Buscar por nombre"
                        value={draftSearch}
                        onChange={event => setDraftSearch(event.target.value)}
                    />
                    <button className="button button--ghost" type="submit">
                        Buscar
                    </button>
                </form>

                <button className="button button--primary" onClick={() => navigate('/products/new')} type="button">
                    <Plus size={16} />
                    Nuevo producto
                </button>
            </section>

            <CollectionToolbar
                summary={`${visibleProducts.length} de ${sortedProducts.length} productos visibles`}
                helperText="Controla cuántos ves y cómo se ordena el catálogo."
                sortValue={sortValue}
                onSortChange={setSortValue}
                sortOptions={[
                    { value: 'name-asc', label: 'Nombre A-Z' },
                    { value: 'name-desc', label: 'Nombre Z-A' },
                    { value: 'price-desc', label: 'Precio mayor a menor' },
                    { value: 'price-asc', label: 'Precio menor a mayor' }
                ]}
                limitValue={visibleLimit}
                onLimitChange={setVisibleLimit}
            />

            {listQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando productos...</p>
                </section>
            ) : listQuery.isError ? (
                <section className="panel panel--error">
                    <p>{listQuery.error.message}</p>
                </section>
            ) : (
                <DataTable
                    columns={columns}
                    rows={visibleProducts}
                    rowKey="id"
                    empty={
                        <EmptyState
                            title="Catálogo vacío"
                            description="Agrega productos o servicios para que ventas pueda operar sin fricción."
                        />
                    }
                />
            )}

            <DrawerForm
                open={Boolean(newMatch || editMatch)}
                title={editMatch ? 'Editar producto' : 'Nuevo producto'}
                description="Actualiza catálogo y precios sin cambiar de contexto."
                onClose={() => navigate(`/products${location.search}`)}
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

                    <label className="field">
                        <span>Precio</span>
                        <input
                            required
                            min="0"
                            step="0.01"
                            type="number"
                            value={form.price}
                            onChange={event =>
                                setForm(current => ({ ...current, price: event.target.value }))
                            }
                        />
                    </label>

                    <label className="field">
                        <span>Duración (minutos)</span>
                        <input
                            required
                            min="15"
                            step="15"
                            type="number"
                            value={form.duration_minutes}
                            onChange={event =>
                                setForm(current => ({
                                    ...current,
                                    duration_minutes: event.target.value
                                }))
                            }
                        />
                    </label>

                    <button className="button button--primary" disabled={saveMutation.isPending} type="submit">
                        {saveMutation.isPending ? 'Guardando...' : editMatch ? 'Actualizar producto' : 'Guardar producto'}
                    </button>
                </form>
            </DrawerForm>
        </div>
    );
}
