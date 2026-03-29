import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    BadgeDollarSign,
    ClipboardList,
    FileText,
    MapPin,
    MessageCircle,
    Phone,
    Settings2,
    UserRound
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { getSessionUser } from '../lib/navigation';

const avatarChoices = ['🌸', '💆', '🪷', '✨', '🧴', '💖', '🌿', '🕯️', '🎀', '🌺', '🫧', '💅'];

function getInitials(name) {
    return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || '')
        .join('');
}

function getClientBadge(client) {
    return client?.avatar_emoji || getInitials(client?.name);
}

function buildWhatsappUrl(phone, name) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';

    const message = encodeURIComponent(`Hola ${name || ''}, te escribo desde SaleySpa.`);
    return `https://wa.me/57${digits}?text=${message}`;
}

export default function ClientProfilePage() {
    const sessionUser = getSessionUser();
    const isAdmin = sessionUser.role === 'admin';
    const { hash } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const isSelfProfile = !hash;

    const profileQuery = useQuery({
        queryKey: ['client-profile', hash || 'self'],
        enabled: Boolean(hash) || isSelfProfile,
        queryFn: () =>
            isSelfProfile
                ? apiFetch('/api/me/profile')
                : apiFetch(`/api/clients/${hash}/profile`)
    });

    const avatarMutation = useMutation({
        mutationFn: avatarEmoji =>
            apiFetch(isSelfProfile ? '/api/me/avatar' : `/api/clients/${hash}/avatar`, {
                method: 'PUT',
                body: { avatar_emoji: avatarEmoji }
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['client-profile', hash || 'self'] });
            await queryClient.invalidateQueries({ queryKey: ['clients'] });
            await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
            showToast('Emoji actualizado', 'success');
        },
        onError: error => {
            showToast(error.message, 'danger');
        }
    });

    const payload = profileQuery.data?.data;
    const client = payload?.client;
    const summary = payload?.summary;
    const whatsappUrl = useMemo(
        () => buildWhatsappUrl(client?.phone, client?.name),
        [client?.phone, client?.name]
    );

    if (profileQuery.isLoading) {
        return (
            <section className="panel">
                <p>Cargando perfil del cliente...</p>
            </section>
        );
    }

    if (profileQuery.isError) {
        return (
            <section className="panel panel--error">
                <p>{profileQuery.error.message}</p>
            </section>
        );
    }

    if (!client || !summary) {
        return (
            <EmptyState
                title="Cliente no encontrado"
                description="No encontre informacion disponible para este perfil."
                action={
                    <Link className="button button--primary" to={isAdmin ? '/clients' : '/appointments'}>
                        {isAdmin ? 'Volver a clientes' : 'Volver a citas'}
                    </Link>
                }
            />
        );
    }

    const quickSections = [
        {
            icon: UserRound,
            title: 'Datos personales',
            subtitle: 'Nombre visible y segmento actual',
            onClick: () =>
                document.getElementById('profile-personal')?.scrollIntoView({ behavior: 'smooth' })
        },
        {
            icon: Phone,
            title: 'Informacion de contacto',
            subtitle: client.phone || 'Sin telefono registrado',
            onClick: () =>
                document.getElementById('profile-contact')?.scrollIntoView({ behavior: 'smooth' })
        },
        {
            icon: MapPin,
            title: 'Direccion',
            subtitle: client.address || 'Sin direccion registrada',
            onClick: () =>
                document.getElementById('profile-address')?.scrollIntoView({ behavior: 'smooth' })
        },
        ...(isAdmin
            ? [
                  {
                      icon: ClipboardList,
                      title: 'Historial de compras',
                      subtitle: `${summary.sales_count} ventas activas`,
                      onClick: () =>
                          document
                              .getElementById('profile-sales')
                              ?.scrollIntoView({ behavior: 'smooth' })
                  },
                  {
                      icon: Settings2,
                      title: 'Facturacion y saldo',
                      subtitle: `${summary.invoices_count} facturas emitidas`,
                      onClick: () =>
                          document
                              .getElementById('profile-billing')
                              ?.scrollIntoView({ behavior: 'smooth' })
                  }
              ]
            : [])
    ];

    return (
        <div className="page-stack">
            <section className="profile-hero panel">
                <button
                    className="inline-link profile-hero__back"
                    onClick={() => navigate(isAdmin ? '/clients' : '/appointments')}
                    type="button"
                >
                    <ArrowLeft size={16} />
                    {isAdmin ? 'Volver a clientes' : 'Volver a citas'}
                </button>

                <div className="profile-hero__cover" aria-hidden="true" />

                <div className="profile-hero__identity" id="profile-personal">
                    <div className="profile-hero__avatar">
                        <span>{getClientBadge(client)}</span>
                    </div>

                    <div className="profile-hero__copy">
                        <h3>{client.name}</h3>
                        <p>{summary.tier_label}</p>
                    </div>
                </div>

                <div className="profile-avatar-picker">
                    <p className="profile-avatar-picker__label">Elige un emoji para este cliente</p>
                    <div className="profile-avatar-picker__grid">
                        {avatarChoices.map(choice => (
                            <button
                                key={choice}
                                className={`profile-avatar-picker__option${
                                    client.avatar_emoji === choice
                                        ? ' profile-avatar-picker__option--active'
                                        : ''
                                }`}
                                disabled={avatarMutation.isPending}
                                onClick={() => avatarMutation.mutate(choice)}
                                type="button"
                            >
                                {choice}
                            </button>
                        ))}
                        <button
                            className="profile-avatar-picker__option"
                            disabled={avatarMutation.isPending}
                            onClick={() => avatarMutation.mutate('')}
                            type="button"
                        >
                            {getInitials(client.name)}
                        </button>
                    </div>
                </div>

                <div className="profile-action-list">
                    {quickSections.map(item => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.title}
                                className="profile-action-card"
                                onClick={item.onClick}
                                type="button"
                            >
                                <span className="profile-action-card__icon">
                                    <Icon size={18} />
                                </span>
                                <span className="profile-action-card__copy">
                                    <strong>{item.title}</strong>
                                    <small>{item.subtitle}</small>
                                </span>
                                <span className="profile-action-card__arrow">›</span>
                            </button>
                        );
                    })}
                </div>

                {!isAdmin ? (
                    <div className="client-detail__actions">
                        <button
                            className="button button--primary"
                            onClick={() => navigate('/profile/edit')}
                            type="button"
                        >
                            Editar mis datos
                        </button>
                    </div>
                ) : null}
            </section>

            <section className="kpi-grid">
                <article className="kpi-card">
                    <span className="kpi-card__label">Compras acumuladas</span>
                    <strong className="kpi-card__value">{formatMoney(summary.total_spent)}</strong>
                    <p className="kpi-card__note">{summary.sales_count} ventas registradas</p>
                </article>

                <article className="kpi-card kpi-card--warning">
                    <span className="kpi-card__label">Saldo pendiente</span>
                    <strong className="kpi-card__value">{formatMoney(summary.pending_balance)}</strong>
                    <p className="kpi-card__note">
                        {summary.pending_balance > 0
                            ? 'Requiere seguimiento de pago'
                            : 'Sin deuda pendiente'}
                    </p>
                </article>

                <article className="kpi-card kpi-card--cyan">
                    <span className="kpi-card__label">Ultima compra</span>
                    <strong className="kpi-card__value">
                        {summary.last_sale_at ? formatDate(summary.last_sale_at) : 'Sin ventas'}
                    </strong>
                    <p className="kpi-card__note">Actividad comercial mas reciente</p>
                </article>
            </section>

            <div className="profile-grid">
                <section className="panel profile-section" id="profile-contact">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Cliente</p>
                            <h3>Informacion de contacto</h3>
                        </div>
                    </div>

                    <div className="client-detail__grid">
                        <article className="client-detail__item">
                            <span className="client-detail__label">Telefono</span>
                            <strong className="client-detail__value">
                                {client.phone || 'Sin telefono'}
                            </strong>
                        </article>

                        <article className="client-detail__item">
                            <span className="client-detail__label">Ultima factura</span>
                            <strong className="client-detail__value">
                                {summary.last_invoice_at
                                    ? formatDate(summary.last_invoice_at)
                                    : 'Sin facturas'}
                            </strong>
                        </article>

                        <article
                            className="client-detail__item client-detail__item--full"
                            id="profile-address"
                        >
                            <span className="client-detail__label">Direccion</span>
                            <strong className="client-detail__value">
                                {client.address || 'Sin direccion registrada'}
                            </strong>
                        </article>

                        <article className="client-detail__item client-detail__item--full">
                            <span className="client-detail__label">Complemento</span>
                            <strong className="client-detail__value">
                                {client.complemento || 'Sin complemento'}
                            </strong>
                        </article>
                    </div>

                    <div className="client-detail__actions">
                        {whatsappUrl ? (
                            <a
                                className="button button--primary"
                                href={whatsappUrl}
                                rel="noreferrer"
                                target="_blank"
                            >
                                <MessageCircle size={16} />
                                WhatsApp
                            </a>
                        ) : null}

                        {isAdmin ? (
                            <a className="button button--ghost" href={`/sales?client_id=${client.id}`}>
                                <ClipboardList size={16} />
                                Ver ventas
                            </a>
                        ) : null}

                        {isAdmin ? (
                            <a className="button button--ghost" href={`/invoices?client_id=${client.id}`}>
                                <FileText size={16} />
                                Ver facturas
                            </a>
                        ) : null}
                    </div>
                </section>

                {isAdmin ? (
                    <section className="panel profile-section" id="profile-billing">
                        <div className="panel__header">
                            <div>
                                <p className="panel__eyebrow">Resumen</p>
                                <h3>Facturacion y saldo</h3>
                            </div>
                        </div>

                        <div className="profile-stat-list">
                            <article className="profile-stat-card">
                                <span className="profile-stat-card__icon">
                                    <BadgeDollarSign size={18} />
                                </span>
                                <div>
                                    <strong>{formatMoney(summary.pending_balance)}</strong>
                                    <small>Saldo pendiente actual</small>
                                </div>
                            </article>

                            <article className="profile-stat-card">
                                <span className="profile-stat-card__icon">
                                    <FileText size={18} />
                                </span>
                                <div>
                                    <strong>{summary.invoices_count}</strong>
                                    <small>Facturas emitidas</small>
                                </div>
                            </article>
                        </div>

                        {payload.recent_invoices.length ? (
                            <div className="profile-history-list">
                                {payload.recent_invoices.map(invoice => (
                                    <article className="profile-history-card" key={invoice.public_id}>
                                        <div>
                                            <strong>{invoice.invoice_number}</strong>
                                            <small>{formatDate(invoice.issue_date)}</small>
                                        </div>
                                        <div className="profile-history-card__meta">
                                            <span
                                                className={`status-pill status-pill--${
                                                    invoice.status === 'PAGADA' ? 'success' : 'warning'
                                                }`}
                                            >
                                                {invoice.status}
                                            </span>
                                            <strong>{formatMoney(invoice.total)}</strong>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="metric-empty">
                                Todavia no hay facturas registradas para este cliente.
                            </p>
                        )}
                    </section>
                ) : null}
            </div>

            {isAdmin ? (
                <section className="panel profile-section" id="profile-sales">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Actividad</p>
                            <h3>Compras recientes</h3>
                        </div>
                    </div>

                    {payload.recent_sales.length ? (
                        <div className="profile-history-list">
                            {payload.recent_sales.map(sale => (
                                <article className="profile-history-card" key={sale.id}>
                                    <div>
                                        <strong>{sale.product_name}</strong>
                                        <small>
                                            {formatDate(sale.sold_at)} · {sale.quantity} unidad
                                            {sale.quantity === 1 ? '' : 'es'}
                                        </small>
                                    </div>
                                    <div className="profile-history-card__meta">
                                        {sale.invoice_public_id ? (
                                            <Link
                                                className="inline-link"
                                                to={`/invoices/${sale.invoice_public_id}`}
                                            >
                                                {sale.invoice_number}
                                            </Link>
                                        ) : (
                                            <span
                                                className={`status-pill status-pill--${
                                                    sale.paid ? 'success' : 'warning'
                                                }`}
                                            >
                                                {sale.paid ? 'PAGADA' : 'PENDIENTE'}
                                            </span>
                                        )}
                                        <strong>{formatMoney(sale.total)}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="Sin historial de compras"
                            description="Este cliente todavia no tiene ventas activas registradas."
                        />
                    )}
                </section>
            ) : null}
        </div>
    );
}
