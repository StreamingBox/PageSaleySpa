import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, FileText, Save } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import {
    formatDate,
    formatMoney,
    isSaleDateWithinWindow,
    saleWindowStartIso,
    todayIso
} from '../lib/format';
import SearchableSelect from '../components/SearchableSelect';
import { useToast } from '../components/Toast';

const emptySale = {
    client_id: '',
    product_id: '',
    quantity: 1,
    unit_price: 0,
    sold_at: todayIso(),
    paid: '0',
    payment_source: 'PENDIENTE'
};

export default function SalesFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { showToast } = useToast();
    const [form, setForm] = useState(emptySale);
    const [errors, setErrors] = useState({});
    const saleDateMin = saleWindowStartIso();
    const saleDateMax = todayIso();

    const clientsQuery = useQuery({
        queryKey: ['clients', 'options', 'sales-form'],
        queryFn: () => apiFetch('/api/clients')
    });

    const productsQuery = useQuery({
        queryKey: ['products', 'options', 'sales-form'],
        queryFn: () => apiFetch('/api/products')
    });

    const saleQuery = useQuery({
        queryKey: ['sale', id],
        enabled: isEdit,
        queryFn: () => apiFetch(`/api/sales/${id}`)
    });

    useEffect(() => {
        if (isEdit || !clientsQuery.data?.data || !productsQuery.data?.data) {
            return;
        }

        const clientId = searchParams.get('client_id') || '';
        const productId = searchParams.get('product_id') || '';
        const soldAt = searchParams.get('sold_at') || todayIso();
        const selectedProduct = productsQuery.data.data.find(
            product => String(product.id) === String(productId)
        );

        if (!clientId && !productId && !searchParams.get('sold_at')) {
            return;
        }

        setForm(current => ({
            ...current,
            client_id: clientId || current.client_id,
            product_id: productId || current.product_id,
            unit_price: selectedProduct ? selectedProduct.price : current.unit_price,
            sold_at: soldAt
        }));
    }, [isEdit, clientsQuery.data, productsQuery.data, searchParams]);

    useEffect(() => {
        if (saleQuery.data?.data) {
            const sale = saleQuery.data.data;
            setForm({
                client_id: String(sale.client_id),
                product_id: String(sale.product_id),
                quantity: sale.quantity,
                unit_price: sale.unit_price,
                sold_at: sale.sold_at,
                paid: String(sale.paid),
                payment_source: sale.payment_source
            });
        }
    }, [saleQuery.data]);

    const total = useMemo(
        () => Number(form.quantity || 0) * Number(form.unit_price || 0),
        [form.quantity, form.unit_price]
    );

    const saveMutation = useMutation({
        mutationFn: values =>
            apiFetch(isEdit ? `/api/sales/${id}` : '/api/sales', {
                method: isEdit ? 'PUT' : 'POST',
                body: {
                    ...values,
                    price: total
                }
            }),
        onSuccess: () => {
            showToast(isEdit ? 'Venta actualizada' : 'Venta registrada', 'success');
            navigate('/sales');
        },
        onError: error => showToast(error.message, 'danger')
    });

    const products = productsQuery.data?.data || [];
    const clients = clientsQuery.data?.data || [];
    const selectedClient = clients.find(client => String(client.id) === String(form.client_id));
    const selectedProduct = products.find(product => String(product.id) === String(form.product_id));
    const lockedInvoicePublicId = saleQuery.data?.data?.invoice_public_id || '';
    const lockedInvoiceNumber = saleQuery.data?.data?.invoice_number || '';
    const isLocked = Boolean(lockedInvoicePublicId);
    const clientOptions = useMemo(() => buildClientSelectOptions(clients), [clients]);
    const productOptions = useMemo(
        () =>
            products.map(product => ({
                value: String(product.id),
                label: product.name,
                description: formatMoney(product.price),
                searchText: `${product.name} ${formatMoney(product.price)}`
            })),
        [products]
    );

    const validate = () => {
        const nextErrors = {};
        if (!form.client_id) nextErrors.client_id = 'Selecciona un cliente';
        if (!form.product_id) nextErrors.product_id = 'Selecciona un producto';
        if (!form.quantity || Number(form.quantity) <= 0) nextErrors.quantity = 'Ingresa una cantidad válida';
        if (!form.sold_at) nextErrors.sold_at = 'Selecciona una fecha';
        if (
            form.sold_at &&
            !isSaleDateWithinWindow(form.sold_at, saleDateMin, saleDateMax)
        ) {
            nextErrors.sold_at = `La fecha debe estar entre ${formatDate(
                saleDateMin
            )} y ${formatDate(saleDateMax)}`;
        }
        if (form.paid === '1' && !form.payment_source) {
            nextErrors.payment_source = 'Selecciona un origen de pago';
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const setProduct = productId => {
        const selectedProduct = products.find(item => String(item.id) === productId);
        setForm(current => ({
            ...current,
            product_id: productId,
            unit_price: selectedProduct ? selectedProduct.price : 0
        }));
    };

    return (
        <div className="page-stack">
            <Link className="inline-link" to="/sales">
                <ArrowLeft size={14} />
                Volver al listado
            </Link>

            <section className="editor-grid">
                <form
                    className="panel panel--editor"
                    onSubmit={event => {
                        event.preventDefault();
                        if (!validate()) return;
                        saveMutation.mutate(form);
                    }}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Ventas</p>
                            <h3>{isEdit ? 'Editar venta' : 'Registrar venta'}</h3>
                        </div>
                    </div>

                    {isLocked ? (
                        <section className="invoice-link-card">
                            <div>
                                <p className="panel__eyebrow">Venta bloqueada</p>
                                <strong>{lockedInvoiceNumber}</strong>
                                <span>
                                    Esta venta ya hace parte de una cuenta de cobro y no puede modificarse.
                                </span>
                            </div>

                            <Link
                                className="button button--ghost"
                                to={`/invoices/${lockedInvoicePublicId}`}
                            >
                                <FileText size={16} />
                                Ver cuenta de cobro
                            </Link>
                        </section>
                    ) : null}

                    <div className="form-grid">
                        <label className="field">
                            <span>Cliente</span>
                            <SearchableSelect
                                value={form.client_id}
                                options={clientOptions}
                                placeholder="Selecciona un cliente"
                                searchPlaceholder="Busca por nombre, teléfono o dirección"
                                emptyMessage="No encontré clientes con ese filtro."
                                disabled={isLocked}
                                onChange={nextValue =>
                                    setForm(current => ({
                                        ...current,
                                        client_id: nextValue
                                    }))
                                }
                            />
                            <small className="field__hint">
                                {selectedClient
                                    ? `Cliente actual: ${selectedClient.name}`
                                    : 'Toca el campo y busca dentro del listado'}
                            </small>
                            {errors.client_id ? <small className="field__error">{errors.client_id}</small> : null}
                        </label>

                        <label className="field">
                            <span>Producto / servicio</span>
                            <SearchableSelect
                                value={form.product_id}
                                options={productOptions}
                                placeholder="Selecciona un producto"
                                searchPlaceholder="Busca por nombre del producto"
                                emptyMessage="No encontré productos con ese filtro."
                                disabled={isLocked}
                                onChange={setProduct}
                            />
                            <small className="field__hint">
                                {selectedProduct
                                    ? `Producto actual: ${selectedProduct.name}`
                                    : 'Toca el campo y busca dentro del catálogo'}
                            </small>
                            {errors.product_id ? <small className="field__error">{errors.product_id}</small> : null}
                        </label>

                        <label className="field">
                            <span>Cantidad</span>
                            <input
                                disabled={isLocked}
                                min="1"
                                step="1"
                                type="number"
                                value={form.quantity}
                                onChange={event =>
                                    setForm(current => ({ ...current, quantity: event.target.value }))
                                }
                            />
                            {errors.quantity ? <small className="field__error">{errors.quantity}</small> : null}
                        </label>

                        <label className="field">
                            <span>Precio unitario</span>
                            <input readOnly value={Number(form.unit_price || 0).toFixed(2)} />
                        </label>

                        <label className="field">
                            <span>Fecha de venta</span>
                            <input
                                disabled={isLocked}
                                max={saleDateMax}
                                min={saleDateMin}
                                type="date"
                                value={form.sold_at}
                                onChange={event =>
                                    setForm(current => ({ ...current, sold_at: event.target.value }))
                                }
                            />
                            <small className="field__hint">
                                Solo entre {formatDate(saleDateMin)} y {formatDate(saleDateMax)}
                            </small>
                            {errors.sold_at ? <small className="field__error">{errors.sold_at}</small> : null}
                        </label>

                        <label className="field">
                            <span>Estado</span>
                            <select
                                disabled={isLocked}
                                value={form.paid}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        paid: event.target.value,
                                        payment_source:
                                            event.target.value === '1'
                                                ? current.payment_source === 'PENDIENTE'
                                                    ? ''
                                                    : current.payment_source
                                                : 'PENDIENTE'
                                    }))
                                }
                            >
                                <option value="0">Pendiente</option>
                                <option value="1">Pagado</option>
                            </select>
                        </label>

                        <label className="field field--full">
                            <span>Origen de pago</span>
                            <select
                                disabled={isLocked || form.paid !== '1'}
                                value={form.payment_source}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        payment_source: event.target.value
                                    }))
                                }
                            >
                                <option value="">Selecciona origen</option>
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="NEQUI">Nequi</option>
                                <option value="DAVIPLATA">Daviplata</option>
                                <option value="TRANSFIYA">Transfiya</option>
                                <option value="NU">Nu</option>
                            </select>
                            {errors.payment_source ? (
                                <small className="field__error">{errors.payment_source}</small>
                            ) : null}
                        </label>
                    </div>

                    {isLocked ? null : (
                        <button
                            className="button button--primary"
                            disabled={saveMutation.isPending}
                            type="submit"
                        >
                            <Save size={16} />
                            {saveMutation.isPending
                                ? 'Guardando...'
                                : isEdit
                                  ? 'Actualizar venta'
                                  : 'Registrar venta'}
                        </button>
                    )}
                </form>

                <aside className="panel panel--summary">
                    <p className="panel__eyebrow">Total actual</p>
                    <h3>{formatMoney(total)}</h3>
                    <div className="summary-metric">
                        <Calculator size={18} />
                        <div>
                            <strong>{form.quantity || 0} unidades</strong>
                            <span>{formatMoney(form.unit_price || 0)} por unidad</span>
                        </div>
                    </div>
                    <p className="summary-note">
                        El total se recalcula automáticamente para evitar inconsistencias entre catálogo y venta.
                    </p>
                </aside>
            </section>
        </div>
    );
}
