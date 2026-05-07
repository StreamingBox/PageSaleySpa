import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, Eye, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { formatDate, formatMoney, getInvoicePdfUrl, todayIso } from '../lib/format';
import DataTable from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';

const paymentOptions = ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TRANSFIYA', 'NU'];

export default function InvoiceDetailPage() {
    const { publicId } = useParams();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [paymentSource, setPaymentSource] = useState('EFECTIVO');
    const [paidAt, setPaidAt] = useState(todayIso());

    const invoiceQuery = useQuery({
        queryKey: ['invoice', publicId],
        queryFn: () => apiFetch(`/api/invoices/${publicId}`)
    });

    useEffect(() => {
        if (!invoiceQuery.data?.data) {
            return;
        }

        const invoice = invoiceQuery.data.data;
        if (invoice.status === 'PAGADA') {
            setPaymentSource(invoice.payment_source || 'EFECTIVO');
            setPaidAt(invoice.paid_at || todayIso());
            return;
        }

        setPaymentSource('EFECTIVO');
        setPaidAt(todayIso());
    }, [invoiceQuery.data]);

    const payMutation = useMutation({
        mutationFn: values =>
            apiFetch(`/api/invoices/${publicId}/pay`, {
                method: 'PATCH',
                body: values
            }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['invoice', publicId] }),
                queryClient.invalidateQueries({ queryKey: ['invoices'] }),
                queryClient.invalidateQueries({ queryKey: ['sales'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            ]);

            showToast('Cuenta de cobro marcada como pagada', 'success');
        },
        onError: error => showToast(error.message, 'danger')
    });

    if (invoiceQuery.isLoading) {
        return (
            <section className="panel">
                <p>Cargando cuenta de cobro...</p>
            </section>
        );
    }

    if (invoiceQuery.isError) {
        return (
            <section className="panel panel--error">
                <p>{invoiceQuery.error.message}</p>
            </section>
        );
    }

    const invoice = invoiceQuery.data.data;

    return (
        <div className="page-stack">
            <Link className="inline-link" to="/invoices">
                <ArrowLeft size={14} />
                Volver a cuentas de cobro
            </Link>

            <section className="panel invoice-detail-header">
                <div>
                    <p className="panel__eyebrow">Cuenta de cobro</p>
                    <h3>{invoice.invoice_number}</h3>
                    <p className="invoice-detail-header__text">
                        Emitida el {formatDate(invoice.issue_date)} para {invoice.client_name}.
                    </p>
                </div>

                <div className="invoice-detail-header__actions">
                    <a
                        className="button button--ghost"
                        href={getInvoicePdfUrl(invoice.public_id)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Eye size={16} />
                        Ver PDF
                    </a>
                    <a
                        className="button button--primary"
                        href={getInvoicePdfUrl(invoice.public_id, true)}
                    >
                        <Download size={16} />
                        Descargar
                    </a>
                </div>
            </section>

            <section className="kpi-grid">
                <article className="kpi-card">
                    <span className="kpi-card__label">Cliente</span>
                    <strong className="kpi-card__value invoice-detail-card__value">
                        {invoice.client_name}
                    </strong>
                    <span className="kpi-card__note">
                        {invoice.client_phone || 'Sin teléfono'} ·{' '}
                        {[invoice.client_address, invoice.client_complemento]
                            .filter(Boolean)
                            .join(' · ') || 'Sin dirección registrada'}
                    </span>
                </article>

                <article
                    className={`kpi-card ${
                        invoice.status === 'PAGADA' ? 'kpi-card--success' : 'kpi-card--warning'
                    }`}
                >
                    <span className="kpi-card__label">Estado</span>
                    <strong className="kpi-card__value invoice-detail-card__value">
                        {invoice.status === 'PAGADA' ? 'Pagada' : 'Pendiente'}
                    </strong>
                    <span className="kpi-card__note">
                        {invoice.status === 'PAGADA'
                            ? `${invoice.payment_source} · ${formatDate(invoice.paid_at)}`
                            : 'Aún pendiente por cobrar'}
                    </span>
                </article>

                <article className="kpi-card kpi-card--cyan">
                    <span className="kpi-card__label">Total</span>
                    <strong className="kpi-card__value invoice-detail-card__value">
                        {formatMoney(invoice.total)}
                    </strong>
                    <span className="kpi-card__note">
                        {invoice.items.length} líneas registradas
                    </span>
                </article>
            </section>

            <section className="editor-grid">
                <section className="panel panel--editor">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Detalle</p>
                            <h3>Productos cobrados</h3>
                        </div>
                    </div>

                    <DataTable
                        columns={[
                            { key: 'line_order', label: '#' },
                            { key: 'product_name', label: 'Producto' },
                            {
                                key: 'sold_at',
                                label: 'Fecha venta',
                                render: row => formatDate(row.sold_at)
                            },
                            { key: 'quantity', label: 'Cant.', align: 'right' },
                            {
                                key: 'unit_price',
                                label: 'Unitario',
                                render: row => formatMoney(row.unit_price)
                            },
                            {
                                key: 'line_total',
                                label: 'Total',
                                render: row => formatMoney(row.line_total)
                            }
                        ]}
                        rows={invoice.items}
                        rowKey="id"
                        empty={
                            <EmptyState
                                title="Sin líneas"
                                description="Esta cuenta de cobro no tiene líneas registradas."
                            />
                        }
                    />
                </section>

                <aside className="panel panel--summary">
                    <p className="panel__eyebrow">Cobro</p>
                    <h3>{formatMoney(invoice.total)}</h3>

                    {invoice.status === 'PAGADA' ? (
                        <div className="invoice-pay-card invoice-pay-card--done">
                            <div className="summary-metric">
                                <CheckCircle2 size={18} />
                                <div>
                                    <strong>Cuenta de cobro cerrada</strong>
                                    <span>
                                        Pagada el {formatDate(invoice.paid_at)} por{' '}
                                        {invoice.payment_source}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form
                            className="invoice-pay-card"
                            onSubmit={event => {
                                event.preventDefault();
                                payMutation.mutate({
                                    payment_source: paymentSource,
                                    paid_at: paidAt
                                });
                            }}
                        >
                            <div className="summary-metric">
                                <Wallet size={18} />
                                <div>
                                    <strong>Marcar como pagada</strong>
                                    <span>Esto actualizará también las ventas incluidas.</span>
                                </div>
                            </div>

                            <label className="field">
                                <span>Origen de pago</span>
                                <select
                                    value={paymentSource}
                                    onChange={event => setPaymentSource(event.target.value)}
                                >
                                    {paymentOptions.map(option => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="field">
                                <span>Fecha de pago</span>
                                <input
                                    type="date"
                                    value={paidAt}
                                    onChange={event => setPaidAt(event.target.value)}
                                />
                            </label>

                            <button
                                className="button button--primary"
                                disabled={payMutation.isPending}
                                type="submit"
                            >
                                {payMutation.isPending ? 'Guardando...' : 'Confirmar pago'}
                            </button>
                        </form>
                    )}

                    <p className="summary-note">
                        La numeración es consecutiva y el PDF permanece disponible para consulta en cualquier momento.
                    </p>
                </aside>
            </section>
        </div>
    );
}
