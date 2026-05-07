import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckSquare, FileText, Save } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import { formatDate, formatMoney, todayIso } from '../lib/format';
import EmptyState from '../components/EmptyState';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../components/Toast';

const emptyForm = {
    client_id: '',
    issue_date: todayIso(),
    sale_ids: []
};

export default function InvoiceFormPage() {
    const [searchParams] = useSearchParams();
    const initialClientId = searchParams.get('client_id') || '';
    const shouldAutoSelectAll = searchParams.get('select_all') === '1';
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [form, setForm] = useState({
        ...emptyForm,
        client_id: initialClientId
    });

    const clientsQuery = useQuery({
        queryKey: ['clients', 'invoice-create'],
        queryFn: () => apiFetch('/api/clients')
    });

    const candidatesQuery = useQuery({
        queryKey: ['invoice-candidates', form.client_id],
        enabled: Boolean(form.client_id),
        queryFn: () => apiFetch(`/api/invoices/candidates?client_id=${form.client_id}`)
    });

    const candidateRows = candidatesQuery.data?.data || [];

    useEffect(() => {
        setForm(current => ({ ...current, sale_ids: [] }));
    }, [form.client_id]);

    useEffect(() => {
        if (!shouldAutoSelectAll || !candidateRows.length || form.sale_ids.length) {
            return;
        }

        setForm(current => ({
            ...current,
            sale_ids: candidateRows.map(row => row.id)
        }));
    }, [candidateRows, form.sale_ids.length, shouldAutoSelectAll]);

    const createMutation = useMutation({
        mutationFn: values =>
            apiFetch('/api/invoices', {
                method: 'POST',
                body: values
            }),
        onSuccess: async response => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['invoices'] }),
                queryClient.invalidateQueries({ queryKey: ['sales'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            ]);

            showToast('Cuenta de cobro creada', 'success');
            navigate(`/invoices/${response.data.public_id}`);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const clientOptions = useMemo(
        () => buildClientSelectOptions(clientsQuery.data?.data || []),
        [clientsQuery.data?.data]
    );

    const selectedCount = form.sale_ids.length;
    const selectedItems = candidateRows.filter(row => form.sale_ids.includes(row.id));
    const total = selectedItems.reduce((sum, row) => sum + Number(row.price || 0), 0);
    const selectedClient = (clientsQuery.data?.data || []).find(
        client => String(client.id) === String(form.client_id)
    );

    const toggleSale = saleId => {
        setForm(current => ({
            ...current,
            sale_ids: current.sale_ids.includes(saleId)
                ? current.sale_ids.filter(currentId => currentId !== saleId)
                : [...current.sale_ids, saleId]
        }));
    };

    return (
        <div className="page-stack">
            <Link className="inline-link" to="/invoices">
                <ArrowLeft size={14} />
                Volver a cuentas de cobro
            </Link>

            <section className="editor-grid">
                <form
                    className="panel panel--editor"
                    onSubmit={event => {
                        event.preventDefault();
                        createMutation.mutate({
                            client_id: Number(form.client_id),
                            issue_date: form.issue_date,
                            sale_ids: form.sale_ids
                        });
                    }}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Cuentas de cobro</p>
                            <h3>Nueva cuenta de cobro</h3>
                        </div>
                    </div>

                    <div className="form-grid">
                        <label className="field">
                            <span>Cliente</span>
                            <SearchableSelect
                                value={form.client_id}
                                options={clientOptions}
                                placeholder="Selecciona un cliente"
                                searchPlaceholder="Busca por nombre o teléfono"
                                emptyMessage="No encontré clientes con ese filtro."
                                onChange={nextValue =>
                                    setForm(current => ({ ...current, client_id: nextValue }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Fecha de emisión</span>
                            <input
                                type="date"
                                value={form.issue_date}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        issue_date: event.target.value
                                    }))
                                }
                            />
                        </label>
                    </div>

                    {!form.client_id ? (
                        <EmptyState
                            title="Primero elige un cliente"
                            description="La cuenta de cobro solo puede agrupar ventas pendientes del mismo cliente."
                        />
                    ) : candidatesQuery.isLoading ? (
                        <section className="panel panel--flat">
                            <p>Cargando ventas pendientes...</p>
                        </section>
                    ) : candidatesQuery.isError ? (
                        <section className="panel panel--error panel--flat">
                            <p>{candidatesQuery.error.message}</p>
                        </section>
                    ) : candidateRows.length ? (
                        <div className="invoice-candidate-section">
                            <div className="invoice-candidate-section__top">
                                <div>
                                    <p className="panel__eyebrow">Ventas pendientes</p>
                                    <strong>{candidateRows.length} disponibles para cuenta de cobro</strong>
                                </div>

                                <div className="table-action-group">
                                    <button
                                        className="table-action"
                                        onClick={() =>
                                            setForm(current => ({
                                                ...current,
                                                sale_ids: candidateRows.map(row => row.id)
                                            }))
                                        }
                                        type="button"
                                    >
                                        <CheckSquare size={14} />
                                        Seleccionar todas
                                    </button>
                                    <button
                                        className="table-action"
                                        onClick={() =>
                                            setForm(current => ({ ...current, sale_ids: [] }))
                                        }
                                        type="button"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <div className="invoice-candidate-list">
                                {candidateRows.map(row => {
                                    const checked = form.sale_ids.includes(row.id);

                                    return (
                                        <label
                                            className={`invoice-candidate-card${
                                                checked ? ' invoice-candidate-card--active' : ''
                                            }`}
                                            key={row.id}
                                        >
                                            <div className="invoice-candidate-card__check">
                                                <input
                                                    checked={checked}
                                                    type="checkbox"
                                                    onChange={() => toggleSale(row.id)}
                                                />
                                            </div>
                                            <div className="invoice-candidate-card__body">
                                                <strong>{row.product_name}</strong>
                                                <span>
                                                    Venta #{row.id} · {formatDate(row.sold_at)}
                                                </span>
                                            </div>
                                            <div className="invoice-candidate-card__meta">
                                                <strong>{row.quantity} uds.</strong>
                                                <span>{formatMoney(row.unit_price)} unitario</span>
                                            </div>
                                            <strong className="invoice-candidate-card__amount">
                                                {formatMoney(row.price)}
                                            </strong>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <EmptyState
                            title="Sin ventas pendientes para cuenta de cobro"
                            description="Este cliente no tiene ventas activas, pendientes y libres de cuenta de cobro."
                        />
                    )}

                    <button
                        className="button button--primary"
                        disabled={createMutation.isPending || !form.sale_ids.length}
                        type="submit"
                    >
                        <Save size={16} />
                        {createMutation.isPending ? 'Creando...' : 'Crear cuenta de cobro'}
                    </button>
                </form>

                <aside className="panel panel--summary">
                    <p className="panel__eyebrow">Resumen</p>
                    <h3>{formatMoney(total)}</h3>
                    <div className="summary-metric">
                        <FileText size={18} />
                        <div>
                            <strong>{selectedCount} ventas seleccionadas</strong>
                            <span>
                                {selectedClient
                                    ? `Cliente: ${selectedClient.name}`
                                    : 'Selecciona un cliente'}
                            </span>
                        </div>
                    </div>
                    <div className="summary-metric">
                        <div>
                            <strong>Emisión</strong>
                            <span>{formatDate(form.issue_date)}</span>
                        </div>
                    </div>
                    <p className="summary-note">
                        La cuenta de cobro se crea en estado pendiente y bloqueará las ventas elegidas para que no puedan asociarse otra vez.
                    </p>
                </aside>
            </section>
        </div>
    );
}
