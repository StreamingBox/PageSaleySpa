import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, UserRound } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { applyVisibleLimit, compareText } from '../lib/collections';
import CollectionToolbar from '../components/CollectionToolbar';
import DataTable from '../components/DataTable';
import DrawerForm from '../components/DrawerForm';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { getSessionUser } from '../lib/navigation';

const emptyClient = {
    name: '',
    phone: '',
    address: '',
    complemento: ''
};

function getInitials(name) {
    return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('');
}

function getClientBadge(client) {
    return client.avatar_emoji || getInitials(client.name);
}

function sortClients(rows, sortValue) {
    const sorted = [...rows];

    switch (sortValue) {
        case 'name-desc':
            return sorted.sort((left, right) => compareText(right.name, left.name));
        case 'phone-asc':
            return sorted.sort((left, right) => compareText(left.phone, right.phone));
        case 'phone-desc':
            return sorted.sort((left, right) => compareText(right.phone, left.phone));
        case 'name-asc':
        default:
            return sorted.sort((left, right) => compareText(left.name, right.name));
    }
}

export default function ClientsPage() {
    const sessionUser = getSessionUser();
    const isAdmin = sessionUser.role === 'admin';
    const [searchParams, setSearchParams] = useSearchParams();
    const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
    const [visibleLimit, setVisibleLimit] = useState('5');
    const [sortValue, setSortValue] = useState('name-asc');
    const [form, setForm] = useState(emptyClient);
    const newMatch = useMatch('/clients/new');
    const editMatch = useMatch('/clients/:hash/edit');
    const selfEditMatch = useMatch('/profile/edit');
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const listQuery = useQuery({
        queryKey: ['clients', location.search],
        enabled: isAdmin,
        queryFn: () => apiFetch(`/api/clients${location.search}`)
    });

    const editQuery = useQuery({
        queryKey: ['client-edit', editMatch?.params.hash, selfEditMatch ? 'self' : 'admin'],
        enabled: Boolean(editMatch?.params.hash) || Boolean(selfEditMatch),
        queryFn: () =>
            selfEditMatch
                ? apiFetch('/api/me/client')
                : apiFetch(`/api/clients/${editMatch.params.hash}`)
    });

    useEffect(() => {
        setDraftSearch(searchParams.get('search') || '');
    }, [searchParams]);

    useEffect(() => {
        if (newMatch && isAdmin) {
            setForm(emptyClient);
            return;
        }

        if (editQuery.data?.data) {
            setForm({
                name: editQuery.data.data.name,
                phone: editQuery.data.data.phone,
                address: editQuery.data.data.address,
                complemento: editQuery.data.data.complemento || ''
            });
        }
    }, [newMatch, editQuery.data]);

    const sortedClients = useMemo(
        () => sortClients(listQuery.data?.data || [], sortValue),
        [listQuery.data?.data, sortValue]
    );

    const visibleClients = useMemo(
        () => applyVisibleLimit(sortedClients, visibleLimit),
        [sortedClients, visibleLimit]
    );

    const saveMutation = useMutation({
        mutationFn: values =>
            apiFetch(selfEditMatch ? '/api/me/client' : editMatch ? `/api/clients/${editMatch.params.hash}` : '/api/clients', {
                method: selfEditMatch || editMatch ? 'PUT' : 'POST',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['clients'] });
            await queryClient.invalidateQueries({ queryKey: ['client-edit'] });
            await queryClient.invalidateQueries({ queryKey: ['my-client'] });
            await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
            if (selfEditMatch && window.__APP_STATE__?.user) {
                window.__APP_STATE__.user.username = form.name;
            }
            showToast(selfEditMatch || editMatch ? 'Datos actualizados' : 'Cliente creado', 'success');
            navigate(selfEditMatch ? '/profile' : `/clients${location.search}`);
        },
        onError: error => {
            showToast(error.message, 'danger');
        }
    });

    const columns = [
        {
            key: 'name',
            label: 'Nombre',
            render: row => (
                <div className="client-cell">
                    <span className="client-cell__avatar">{getClientBadge(row)}</span>
                    <div className="client-cell__copy">
                        <button
                            className="client-cell__name-button"
                            onClick={() => navigate(`/clients/${row.hash}`)}
                            type="button"
                        >
                            {row.name}
                        </button>
                        <span>{row.phone ? 'Contacto disponible' : 'Sin teléfono registrado'}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'phone',
            label: 'Teléfono',
            render: row => (
                <span
                    className={`client-cell__phone${
                        row.phone ? '' : ' client-cell__phone--muted'
                    }`}
                >
                    {row.phone || 'Sin teléfono'}
                </span>
            )
        },
        {
            key: 'address',
            label: 'Dirección',
            render: row => (
                <span
                    className={`client-cell__address${
                        row.address ? '' : ' client-cell__address--muted'
                    }`}
                >
                    {row.address || 'Sin dirección registrada'}
                </span>
            )
        },
        {
            key: 'complemento',
            label: 'Complemento',
            render: row => (
                <span
                    className={`client-cell__address${
                        row.complemento ? '' : ' client-cell__address--muted'
                    }`}
                >
                    {row.complemento || 'Sin complemento'}
                </span>
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
                        onClick={() => navigate(`/clients/${row.hash}`)}
                        type="button"
                    >
                        <UserRound size={14} />
                        Perfil
                    </button>
                    <button
                        className="table-action"
                        onClick={() => navigate(`/clients/${row.hash}/edit${location.search}`)}
                        type="button"
                    >
                        <Pencil size={14} />
                        Editar
                    </button>
                </div>
            )
        }
    ];

    const submitSearch = event => {
        event.preventDefault();
        setSearchParams(draftSearch ? { search: draftSearch } : {});
    };

    const isDrawerOpen = Boolean((isAdmin && (newMatch || editMatch)) || selfEditMatch);

    if (!isAdmin && selfEditMatch) {
        return (
            <div className="page-stack">
                <DrawerForm
                    open
                    title="Editar perfil"
                    description="Actualiza tus datos personales."
                    placement="centered"
                    onClose={() => navigate('/profile')}
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
                            <span>Teléfono</span>
                            <input
                                value={form.phone}
                                onChange={event =>
                                    setForm(current => ({ ...current, phone: event.target.value }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Dirección</span>
                            <input
                                value={form.address}
                                onChange={event =>
                                    setForm(current => ({ ...current, address: event.target.value }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Complemento</span>
                            <input
                                value={form.complemento}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        complemento: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <button
                            className="button button--primary"
                            disabled={saveMutation.isPending}
                            type="submit"
                        >
                            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </form>
                </DrawerForm>
            </div>
        );
    }

    return (
        <div className="page-stack">
            <section className="page-actions page-actions--clients">
                <form className="search-bar" onSubmit={submitSearch}>
                    <Search size={16} />
                    <input
                        placeholder="Buscar por nombre, teléfono, dirección o complemento"
                        value={draftSearch}
                        onChange={event => setDraftSearch(event.target.value)}
                    />
                    <button className="button button--ghost" type="submit">
                        Buscar
                    </button>
                </form>

                {isAdmin ? (
                    <button
                        className="button button--primary"
                        onClick={() => navigate('/clients/new')}
                        type="button"
                    >
                        <Plus size={16} />
                        Nuevo cliente
                    </button>
                ) : null}
            </section>

            {isAdmin ? (
                <CollectionToolbar
                    summary={`${visibleClients.length} de ${sortedClients.length} clientes visibles`}
                    helperText="Top y ordenamiento activo para todo el listado."
                    sortValue={sortValue}
                    onSortChange={setSortValue}
                    sortOptions={[
                        { value: 'name-asc', label: 'Nombre A-Z' },
                        { value: 'name-desc', label: 'Nombre Z-A' },
                        { value: 'phone-asc', label: 'Teléfono 0-9' },
                        { value: 'phone-desc', label: 'Teléfono 9-0' }
                    ]}
                    limitValue={visibleLimit}
                    onLimitChange={setVisibleLimit}
                />
            ) : null}

            {listQuery.isLoading ? (
                <section className="panel">
                    <p>Cargando clientes...</p>
                </section>
            ) : listQuery.isError ? (
                <section className="panel panel--error">
                    <p>{listQuery.error.message}</p>
                </section>
            ) : (
                <DataTable
                    columns={columns}
                    rows={visibleClients}
                    rowKey="id"
                    className="data-table--clients"
                    empty={
                        <EmptyState
                            title="No hay clientes registrados"
                            description="Crea tu primer cliente para comenzar a operar en el nuevo panel."
                            action={
                                <button
                                    className="button button--primary"
                                    onClick={() => navigate('/clients/new')}
                                    type="button"
                                >
                                    Crear cliente
                                </button>
                            }
                        />
                    }
                />
            )}

            <DrawerForm
                open={isDrawerOpen}
                title={editMatch ? 'Editar cliente' : 'Nuevo cliente'}
                description="Actualiza los datos sin salir del listado."
                placement="centered"
                onClose={() => navigate(`/clients${location.search}`)}
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
                        <span>Teléfono</span>
                        <input
                            value={form.phone}
                            onChange={event =>
                                setForm(current => ({ ...current, phone: event.target.value }))
                            }
                        />
                    </label>

                    <label className="field">
                        <span>Dirección</span>
                        <input
                            value={form.address}
                            onChange={event =>
                                setForm(current => ({ ...current, address: event.target.value }))
                            }
                        />
                    </label>

                    <label className="field">
                        <span>Complemento</span>
                        <input
                            value={form.complemento}
                            onChange={event =>
                                setForm(current => ({
                                    ...current,
                                    complemento: event.target.value
                                }))
                            }
                        />
                    </label>

                    <button
                        className="button button--primary"
                        disabled={saveMutation.isPending}
                        type="submit"
                    >
                        {saveMutation.isPending
                            ? 'Guardando...'
                            : editMatch
                              ? 'Actualizar cliente'
                              : 'Guardar cliente'}
                    </button>
                </form>
            </DrawerForm>
        </div>
    );
}
