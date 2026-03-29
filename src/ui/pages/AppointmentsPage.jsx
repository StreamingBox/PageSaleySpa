import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Ban,
    CalendarDays,
    Clock3,
    Cog,
    ExternalLink,
    LayoutGrid,
    MapPin,
    PencilLine,
    ReceiptText,
    Trash2
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { buildClientSelectOptions } from '../lib/clientOptions';
import { formatDate, formatTime, todayIso } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import KpiCard from '../components/KpiCard';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import AppointmentEditorDrawer from '../components/AppointmentEditorDrawer';
import { useToast } from '../components/Toast';
import { getSessionUser } from '../lib/navigation';
import UserAppointmentsPage from './UserAppointmentsPage';

const appointmentStatusOptions = [
    { value: '', label: 'Todas', searchText: 'todas' },
    { value: 'PROGRAMADA', label: 'Programadas', searchText: 'programadas' },
    { value: 'ATENDIDA', label: 'Atendidas', searchText: 'atendidas' },
    { value: 'CANCELADA', label: 'Canceladas', searchText: 'canceladas' }
];

const sectionTabs = [
    { id: 'overview', label: 'Resumen', icon: LayoutGrid },
    { id: 'book', label: 'Agendar', icon: CalendarDays },
    { id: 'settings', label: 'Configurar', icon: Cog },
    { id: 'agenda', label: 'Agenda', icon: Clock3 }
];

const moneyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const emptySettings = {
    day_start: '09:00',
    day_end: '18:00',
    slot_minutes: 30,
    lead_time_hours: 2,
    business_name: 'SaleySpa',
    business_address: 'Bogota, Colombia',
    calendar_email: '',
    google_calendar_connected: false
};

function createBookingForm(defaultDate) {
    return {
        client_id: '',
        product_id: '',
        appointment_date: defaultDate,
        duration_minutes: '60',
        start_time: '',
        notes: ''
    };
}

function buildProductOptions(products) {
    return products.map(product => ({
        value: String(product.id),
        label: product.name,
        description: `${product.duration_minutes} min · ${moneyFormatter.format(product.price)}`,
        searchText: `${product.name} ${product.duration_minutes}`
    }));
}

function getStatusClass(status) {
    if (status === 'CANCELADA') {
        return 'status-pill status-pill--warning';
    }

    if (status === 'ATENDIDA') {
        return 'status-pill';
    }

    return 'status-pill status-pill--success';
}

function AdminAppointmentsPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const initialDate = todayIso();
    const [filterDate, setFilterDate] = useState(initialDate);
    const [statusFilter, setStatusFilter] = useState('');
    const [activeSection, setActiveSection] = useState('overview');
    const [bookingForm, setBookingForm] = useState(createBookingForm(initialDate));
    const [settingsForm, setSettingsForm] = useState(emptySettings);
    const [blockForm, setBlockForm] = useState({
        block_date: initialDate,
        start_time: '12:00',
        end_time: '13:00',
        reason: ''
    });
    const [pendingCancel, setPendingCancel] = useState(null);
    const [editingAppointment, setEditingAppointment] = useState(null);

    const settingsQuery = useQuery({
        queryKey: ['appointment-settings'],
        queryFn: () => apiFetch('/api/appointments/settings')
    });

    const summaryQuery = useQuery({
        queryKey: ['appointment-summary', filterDate],
        queryFn: () => apiFetch(`/api/appointments/summary?date=${encodeURIComponent(filterDate)}`)
    });

    const clientsQuery = useQuery({
        queryKey: ['clients', 'options', 'appointments'],
        queryFn: () => apiFetch('/api/clients')
    });

    const productsQuery = useQuery({
        queryKey: ['products', 'options', 'appointments'],
        queryFn: () => apiFetch('/api/products')
    });

    const availabilityQuery = useQuery({
        queryKey: [
            'appointment-availability',
            bookingForm.appointment_date,
            bookingForm.product_id,
            bookingForm.duration_minutes
        ],
        enabled: Boolean(bookingForm.appointment_date),
        queryFn: () =>
            apiFetch(
                `/api/appointments/availability?date=${encodeURIComponent(
                    bookingForm.appointment_date
                )}${
                    bookingForm.product_id
                        ? `&product_id=${encodeURIComponent(bookingForm.product_id)}`
                        : ''
                }${
                    bookingForm.duration_minutes
                        ? `&duration_minutes=${encodeURIComponent(bookingForm.duration_minutes)}`
                        : ''
                }`
            )
    });

    const appointmentsQuery = useQuery({
        queryKey: ['appointments', filterDate, statusFilter],
        queryFn: () =>
            apiFetch(
                `/api/appointments?date=${encodeURIComponent(filterDate)}${
                    statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''
                }`
            )
    });

    const recentAppointmentsQuery = useQuery({
        queryKey: ['appointments', 'recent-top-5'],
        queryFn: () =>
            apiFetch(
                `/api/appointments?start_date=${encodeURIComponent(todayIso())}&status=PROGRAMADA&limit=5`
            )
    });

    useEffect(() => {
        if (settingsQuery.data?.data) {
            setSettingsForm(settingsQuery.data.data);
            setBookingForm(current => ({
                ...current,
                duration_minutes: current.duration_minutes || String(settingsQuery.data.data.slot_minutes || 30)
            }));
        }
    }, [settingsQuery.data]);

    useEffect(() => {
        if (!availabilityQuery.data?.data?.slots?.length) {
            setBookingForm(current => ({ ...current, start_time: '' }));
            return;
        }

        const hasCurrentSlot = availabilityQuery.data.data.slots.some(
            slot => slot.start_time === bookingForm.start_time
        );

        if (!hasCurrentSlot) {
            setBookingForm(current => ({
                ...current,
                start_time: availabilityQuery.data.data.slots[0].start_time
            }));
        }
    }, [availabilityQuery.data, bookingForm.start_time]);

    useEffect(() => {
        setBlockForm(current =>
            current.block_date === bookingForm.appointment_date
                ? current
                : { ...current, block_date: bookingForm.appointment_date }
        );
    }, [bookingForm.appointment_date]);

    const saveSettingsMutation = useMutation({
        mutationFn: values =>
            apiFetch('/api/appointments/settings', {
                method: 'PUT',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointment-settings'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            showToast('Configuracion de agenda actualizada', 'success');
        },
        onError: error => showToast(error.message, 'danger')
    });

    const bookAppointmentMutation = useMutation({
        mutationFn: values =>
            apiFetch('/api/appointments', {
                method: 'POST',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointments'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Cita registrada y visible para administracion', 'success');
            setBookingForm(current => ({
                ...createBookingForm(current.appointment_date),
                product_id: current.product_id,
                duration_minutes: current.duration_minutes
            }));
        },
        onError: error => showToast(error.message, 'danger')
    });

    const blockMutation = useMutation({
        mutationFn: values =>
            apiFetch('/api/appointments/blocks', {
                method: 'POST',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Bloqueo creado en la agenda', 'success');
        },
        onError: error => showToast(error.message, 'danger')
    });

    const deleteBlockMutation = useMutation({
        mutationFn: id =>
            apiFetch(
                `/api/appointments/blocks/${id}?date=${encodeURIComponent(bookingForm.appointment_date)}`,
                { method: 'DELETE' }
            ),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Bloqueo eliminado', 'success');
        },
        onError: error => showToast(error.message, 'danger')
    });

    const cancelMutation = useMutation({
        mutationFn: appointment =>
            apiFetch(`/api/appointments/${appointment.id}/cancel`, {
                method: 'PATCH',
                body: { reason: 'Cancelada por administracion' }
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointments'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Cita cancelada', 'success');
            setPendingCancel(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const confirmMutation = useMutation({
        mutationFn: appointment =>
            apiFetch(`/api/appointments/${appointment.id}/confirm`, {
                method: 'PATCH'
            }),
        onSuccess: async result => {
            const appointment = result?.data;
            await queryClient.invalidateQueries({ queryKey: ['appointments'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Cita confirmada. Continúa con el registro de venta.', 'success');

            if (appointment) {
                const params = new URLSearchParams({
                    client_id: String(appointment.client_id),
                    product_id: String(appointment.product_id),
                    sold_at: appointment.appointment_date
                });

                navigate(`/sales/new?${params.toString()}`);
            }
        },
        onError: error => showToast(error.message, 'danger')
    });

    const updateAppointmentMutation = useMutation({
        mutationFn: values =>
            apiFetch(`/api/appointments/${editingAppointment.id}`, {
                method: 'PUT',
                body: values
            }),
        onSuccess: async result => {
            const appointment = result?.data;
            await queryClient.invalidateQueries({ queryKey: ['appointments'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast(
                appointment?.status === 'PROGRAMADA' && editingAppointment?.status === 'CANCELADA'
                    ? 'Cita reagendada correctamente'
                    : 'Cita actualizada correctamente',
                'success'
            );
            setEditingAppointment(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const clients = clientsQuery.data?.data || [];
    const products = productsQuery.data?.data || [];
    const summary = summaryQuery.data?.data;
    const appointments = appointmentsQuery.data?.data || [];
    const recentAppointments = recentAppointmentsQuery.data?.data || [];
    const availability = availabilityQuery.data?.data;
    const selectedProduct = products.find(
        product => String(product.id) === String(bookingForm.product_id)
    );
    const clientOptions = useMemo(() => buildClientSelectOptions(clients), [clients]);
    const productOptions = useMemo(() => buildProductOptions(products), [products]);
    const durationOptions = useMemo(() => {
        const step = Math.max(15, Number(settingsForm.slot_minutes || 30));
        const options = [];

        for (let minutes = step; minutes <= 240; minutes += step) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            const label =
                hours && remainingMinutes
                    ? `${hours} h ${remainingMinutes} min`
                    : hours
                      ? `${hours} h`
                      : `${remainingMinutes} min`;

            options.push(
                <option key={minutes} value={String(minutes)}>
                    {label}
                </option>
            );
        }

        return options;
    }, [settingsForm.slot_minutes]);
    const showOverview = activeSection === 'overview';
    const showBook = activeSection === 'book';
    const showSettings = activeSection === 'settings';
    const showAgenda = activeSection === 'agenda';

    return (
        <div className="page-stack">
            <section className="hero">
                <div>
                    <p className="hero__eyebrow">Agenda inteligente</p>
                    <h3>Modulo de citas</h3>
                    <p className="hero__text">
                        Administra disponibilidad, bloqueos, servicios y accesos directos a Google
                        Calendar y Google Maps desde un solo lugar.
                    </p>
                </div>
            </section>

            <section className="appointments-mobile-nav">
                {sectionTabs.map(tab => {
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            className={`appointments-mobile-nav__button${
                                activeSection === tab.id
                                    ? ' appointments-mobile-nav__button--active'
                                    : ''
                            }`}
                            onClick={() => setActiveSection(tab.id)}
                            type="button"
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </section>

            <section
                className={`kpi-grid appointments-section${
                    showOverview ? ' appointments-section--active' : ''
                }`}
            >
                <KpiCard
                    label="Citas activas"
                    value={summary ? String(summary.scheduled_count) : '0'}
                    note="Reservas futuras programadas"
                />
                <KpiCard
                    label="Nuevas hoy"
                    value={summary ? String(summary.created_today_count) : '0'}
                    note="Sirve como notificacion para administracion"
                    accent="cyan"
                />
                <KpiCard
                    label="Agenda de hoy"
                    value={summary ? String(summary.today_count) : '0'}
                    note="Citas vigentes para la fecha consultada"
                    accent="success"
                />
                <KpiCard
                    label="Bloqueos y cancelaciones"
                    value={summary ? String(summary.blocked_count + summary.cancelled_count) : '0'}
                    note={`${summary ? summary.cancelled_count : 0} canceladas / ${
                        summary ? summary.blocked_count : 0
                    } bloqueos`}
                    accent="warning"
                />
            </section>

            <section className="appointments-grid appointments-grid--workspace">
                <article
                    className={`panel appointments-panel appointments-panel--booking appointments-panel-section${
                        showBook ? ' appointments-panel-section--active' : ''
                    }`}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Reserva</p>
                            <h3>Agendar cita</h3>
                        </div>
                    </div>

                    <form
                        className="stack-form"
                        onSubmit={event => {
                            event.preventDefault();
                            bookAppointmentMutation.mutate(bookingForm);
                        }}
                    >
                        <label className="field">
                            <span>Cliente</span>
                            <SearchableSelect
                                value={bookingForm.client_id}
                                options={clientOptions}
                                placeholder="Selecciona un cliente"
                                searchPlaceholder="Busca por nombre, telefono o direccion"
                                emptyMessage="No encontre clientes con ese filtro."
                                onChange={nextValue =>
                                    setBookingForm(current => ({ ...current, client_id: nextValue }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Servicio</span>
                            <SearchableSelect
                                value={bookingForm.product_id}
                                options={productOptions}
                                placeholder="Selecciona un servicio"
                                searchPlaceholder="Busca por nombre o duracion"
                                emptyMessage="No encontre servicios con ese filtro."
                                onChange={nextValue => {
                                    const nextProduct = products.find(
                                        product => String(product.id) === String(nextValue)
                                    );

                                    setBookingForm(current => ({
                                        ...current,
                                        product_id: nextValue,
                                        duration_minutes: String(
                                            nextProduct?.duration_minutes ||
                                                settingsForm.slot_minutes ||
                                                30
                                        ),
                                        start_time: ''
                                    }));
                                }}
                            />
                            <small className="field__hint">
                                {selectedProduct
                                    ? `Base del servicio: ${selectedProduct.duration_minutes} minutos`
                                    : 'El cliente puede elegir desde el catalogo actual de productos.'}
                            </small>
                        </label>

                        <label className="field">
                            <span>Duracion de la cita</span>
                            <select
                                value={bookingForm.duration_minutes}
                                onChange={event =>
                                    setBookingForm(current => ({
                                        ...current,
                                        duration_minutes: event.target.value,
                                        start_time: ''
                                    }))
                                }
                            >
                                {durationOptions}
                            </select>
                            <small className="field__hint">
                                Puedes extender la sesion hasta 4 horas segun el tiempo que necesites.
                            </small>
                        </label>

                        <label className="field">
                            <span>Fecha</span>
                            <input
                                min={todayIso()}
                                type="date"
                                value={bookingForm.appointment_date}
                                onChange={event =>
                                    setBookingForm(current => ({
                                        ...current,
                                        appointment_date: event.target.value,
                                        start_time: ''
                                    }))
                                }
                            />
                            <small className="field__hint">
                                La reserva solo se permite con al menos {settingsForm.lead_time_hours}{' '}
                                horas de anticipacion.
                            </small>
                        </label>

                        <div className="field">
                            <span>Horarios disponibles</span>
                            {!bookingForm.product_id ? (
                                <p className="field__hint">
                                    Primero selecciona el servicio para calcular su duracion.
                                </p>
                            ) : availabilityQuery.isLoading ? (
                                <p className="field__hint">Buscando espacios disponibles...</p>
                            ) : availability?.slots?.length ? (
                                <div className="appointment-slot-grid">
                                    {availability.slots.map(slot => (
                                        <button
                                            key={slot.start_time}
                                            className={`appointment-slot${
                                                bookingForm.start_time === slot.start_time
                                                    ? ' appointment-slot--active'
                                                    : ''
                                            }`}
                                            type="button"
                                            onClick={() =>
                                                setBookingForm(current => ({
                                                    ...current,
                                                    start_time: slot.start_time
                                                }))
                                            }
                                        >
                                            <Clock3 size={14} />
                                            {formatTime(slot.start_time)}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="field__hint">
                                    No hay espacios libres para esa fecha y servicio.
                                </p>
                            )}
                        </div>

                        <label className="field">
                            <span>Notas</span>
                            <textarea
                                rows="3"
                                value={bookingForm.notes}
                                onChange={event =>
                                    setBookingForm(current => ({
                                        ...current,
                                        notes: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <button
                            className="button button--primary"
                            disabled={
                                bookAppointmentMutation.isPending ||
                                !bookingForm.client_id ||
                                !bookingForm.product_id ||
                                !bookingForm.start_time
                            }
                            type="submit"
                        >
                            <CalendarDays size={16} />
                            {bookAppointmentMutation.isPending
                                ? 'Guardando cita...'
                                : 'Confirmar cita'}
                        </button>
                    </form>
                </article>
            </section>

            <section className="appointments-grid appointments-grid--workspace">
                <article
                    className={`panel appointments-panel appointments-panel-section${
                        showAgenda ? ' appointments-panel-section--active' : ''
                    }`}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Bloqueos</p>
                            <h3>Bloquear espacios</h3>
                        </div>
                    </div>

                    <form
                        className="stack-form"
                        onSubmit={event => {
                            event.preventDefault();
                            blockMutation.mutate(blockForm);
                        }}
                    >
                        <div className="form-grid">
                            <label className="field">
                                <span>Fecha</span>
                                <input
                                    min={todayIso()}
                                    type="date"
                                    value={blockForm.block_date}
                                    onChange={event => {
                                        const nextDate = event.target.value;
                                        setBlockForm(current => ({
                                            ...current,
                                            block_date: nextDate
                                        }));
                                        setBookingForm(current => ({
                                            ...current,
                                            appointment_date: nextDate,
                                            start_time: ''
                                        }));
                                    }}
                                />
                            </label>

                            <label className="field">
                                <span>Desde</span>
                                <input
                                    type="time"
                                    value={blockForm.start_time}
                                    onChange={event =>
                                        setBlockForm(current => ({
                                            ...current,
                                            start_time: event.target.value
                                        }))
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Hasta</span>
                                <input
                                    type="time"
                                    value={blockForm.end_time}
                                    onChange={event =>
                                        setBlockForm(current => ({
                                            ...current,
                                            end_time: event.target.value
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Motivo</span>
                            <input
                                placeholder="Almuerzo, mantenimiento, cierre..."
                                value={blockForm.reason}
                                onChange={event =>
                                    setBlockForm(current => ({
                                        ...current,
                                        reason: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <button
                            className="button button--ghost"
                            disabled={blockMutation.isPending}
                            type="submit"
                        >
                            <Ban size={16} />
                            {blockMutation.isPending ? 'Bloqueando...' : 'Bloquear agenda'}
                        </button>
                    </form>

                    <div className="appointment-block-list">
                        {(availability?.blocks || []).length ? (
                            availability.blocks.map(block => (
                                <article className="appointment-block-card" key={block.id}>
                                    <div>
                                        <strong>
                                            {formatDate(block.block_date)} · {formatTime(block.start_time)} -{' '}
                                            {formatTime(block.end_time)}
                                        </strong>
                                        <span>{block.reason || 'Bloqueo manual del administrador'}</span>
                                    </div>
                                    <button
                                        className="table-action table-action--danger"
                                        disabled={deleteBlockMutation.isPending}
                                        onClick={() => deleteBlockMutation.mutate(block.id)}
                                        type="button"
                                    >
                                        <Trash2 size={14} />
                                        Quitar
                                    </button>
                                </article>
                            ))
                        ) : (
                            <p className="field__hint">
                                No hay bloqueos en la fecha consultada para la agenda.
                            </p>
                        )}
                    </div>
                </article>

                <article
                    className={`panel appointments-panel appointments-panel--list appointments-panel-section${
                        showAgenda ? ' appointments-panel-section--active' : ''
                    }`}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Seguimiento</p>
                            <h3>Citas del dia</h3>
                        </div>
                    </div>

                    <div className="filter-bar appointments-filter-bar">
                        <div className="filter-bar__fields">
                            <label className="field">
                                <span>Fecha</span>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={event => setFilterDate(event.target.value)}
                                />
                            </label>
                            <label className="field">
                                <span>Estado</span>
                                <SearchableSelect
                                    value={statusFilter}
                                    options={appointmentStatusOptions}
                                    placeholder="Todas"
                                    searchPlaceholder="Busca estado"
                                    emptyMessage="No encontre estados."
                                    onChange={setStatusFilter}
                                />
                            </label>
                        </div>
                    </div>

                    {appointmentsQuery.isLoading ? (
                        <p>Cargando citas...</p>
                    ) : appointmentsQuery.isError ? (
                        <p>{appointmentsQuery.error.message}</p>
                    ) : appointments.length ? (
                        <div className="appointment-card-list">
                            {appointments.map(appointment => (
                                <article className="appointment-card" key={appointment.id}>
                                    <div className="appointment-card__top">
                                        <div>
                                            <span className={getStatusClass(appointment.status)}>
                                                {appointment.status}
                                            </span>
                                            <h4>{appointment.client_name}</h4>
                                            <p>
                                                {appointment.product_name} · {formatDate(
                                                    appointment.appointment_date
                                                )}{' '}
                                                · {formatTime(appointment.start_time)} -{' '}
                                                {formatTime(appointment.end_time)}
                                            </p>
                                        </div>
                                        <div className="appointment-card__actions">
                                            {appointment.google_calendar_url ? (
                                                <a
                                                    className="button button--ghost"
                                                    href={appointment.google_calendar_url}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    <CalendarDays size={16} />
                                                    Google Calendar
                                                    <ExternalLink size={14} />
                                                </a>
                                            ) : null}

                                            {appointment.google_maps_url ? (
                                                <a
                                                    className="button button--ghost"
                                                    href={appointment.google_maps_url}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    <MapPin size={16} />
                                                    Google Maps
                                                    <ExternalLink size={14} />
                                                </a>
                                            ) : null}

                                            {appointment.status !== 'ATENDIDA' ? (
                                                <button
                                                    className="button button--ghost"
                                                    onClick={() => setEditingAppointment(appointment)}
                                                    type="button"
                                                >
                                                    <PencilLine size={16} />
                                                    {appointment.status === 'CANCELADA'
                                                        ? 'Reagendar'
                                                        : 'Editar'}
                                                </button>
                                            ) : null}

                                            {appointment.status === 'PROGRAMADA' ? (
                                                <button
                                                    className="button button--primary"
                                                    disabled={confirmMutation.isPending}
                                                    onClick={() => confirmMutation.mutate(appointment)}
                                                    type="button"
                                                >
                                                    <ReceiptText size={16} />
                                                    Confirmar y venta
                                                </button>
                                            ) : null}

                                            {appointment.status !== 'CANCELADA' &&
                                            appointment.status !== 'ATENDIDA' ? (
                                                <button
                                                    className="button button--danger"
                                                    onClick={() => setPendingCancel(appointment)}
                                                    type="button"
                                                >
                                                    Cancelar
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="appointment-card__meta">
                                        <span>
                                            <strong>Telefono:</strong> {appointment.client_phone || 'Sin telefono'}
                                        </span>
                                        <span>
                                            <strong>Duracion:</strong>{' '}
                                            {appointment.appointment_duration_minutes} min
                                        </span>
                                        <span>
                                            <strong>Sync Google:</strong> {appointment.google_sync_status}
                                        </span>
                                    </div>

                                    {appointment.notes ? (
                                        <p className="appointment-card__notes">{appointment.notes}</p>
                                    ) : null}
                                    {appointment.google_sync_error ? (
                                        <p className="appointment-card__notes">
                                            Error Google: {appointment.google_sync_error}
                                        </p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    ) : recentAppointments.length ? (
                        <div className="appointment-card-list">
                            <p className="field__hint">
                                No hubo coincidencias para esta fecha. Estas son las 5 agendas programadas mas cercanas.
                            </p>
                            {recentAppointments.map(appointment => (
                                <article className="appointment-card" key={appointment.id}>
                                    <div className="appointment-card__top">
                                        <div>
                                            <span className={getStatusClass(appointment.status)}>
                                                {appointment.status}
                                            </span>
                                            <h4>{appointment.client_name}</h4>
                                            <p>
                                                {appointment.product_name} · {formatDate(
                                                    appointment.appointment_date
                                                )}{' '}
                                                · {formatTime(appointment.start_time)} -{' '}
                                                {formatTime(appointment.end_time)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="appointment-card__meta">
                                        <span>
                                            <strong>Telefono:</strong> {appointment.client_phone || 'Sin telefono'}
                                        </span>
                                        <span>
                                            <strong>Duracion:</strong>{' '}
                                            {appointment.appointment_duration_minutes} min
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="Sin citas para esta consulta"
                            description="No hay resultados en esta fecha. Debajo se muestran las 5 agendas programadas mas cercanas cuando existan."
                        />
                    )}
                </article>
            </section>

            <section
                className={`appointments-grid appointments-section${
                    showSettings ? ' appointments-section--active' : ''
                }`}
            >
                <article
                    className={`panel appointments-panel appointments-panel-section${
                        showSettings ? ' appointments-panel-section--active' : ''
                    }`}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Control</p>
                            <h3>Configuracion de agenda</h3>
                        </div>
                    </div>

                    <form
                        className="stack-form"
                        onSubmit={event => {
                            event.preventDefault();
                            saveSettingsMutation.mutate(settingsForm);
                        }}
                    >
                        <div className="form-grid">
                            <label className="field">
                                <span>Hora inicial</span>
                                <input
                                    type="time"
                                    value={settingsForm.day_start}
                                    onChange={event =>
                                        setSettingsForm(current => ({
                                            ...current,
                                            day_start: event.target.value
                                        }))
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Hora final</span>
                                <input
                                    type="time"
                                    value={settingsForm.day_end}
                                    onChange={event =>
                                        setSettingsForm(current => ({
                                            ...current,
                                            day_end: event.target.value
                                        }))
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Slot base</span>
                                <input
                                    min="15"
                                    step="15"
                                    type="number"
                                    value={settingsForm.slot_minutes}
                                    onChange={event =>
                                        setSettingsForm(current => ({
                                            ...current,
                                            slot_minutes: event.target.value
                                        }))
                                    }
                                />
                            </label>

                            <label className="field">
                                <span>Anticipacion minima</span>
                                <input
                                    min="1"
                                    step="1"
                                    type="number"
                                    value={settingsForm.lead_time_hours}
                                    onChange={event =>
                                        setSettingsForm(current => ({
                                            ...current,
                                            lead_time_hours: event.target.value
                                        }))
                                    }
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Nombre del negocio</span>
                            <input
                                value={settingsForm.business_name}
                                onChange={event =>
                                    setSettingsForm(current => ({
                                        ...current,
                                        business_name: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Direccion del spa</span>
                            <input
                                value={settingsForm.business_address}
                                onChange={event =>
                                    setSettingsForm(current => ({
                                        ...current,
                                        business_address: event.target.value
                                    }))
                                }
                            />
                            <small className="field__hint">
                                Esta direccion se usa para Google Maps y como ubicacion del evento.
                            </small>
                        </label>

                        <label className="field">
                            <span>Correo del Google Calendar</span>
                            <input
                                placeholder="tunombre@gmail.com"
                                type="email"
                                value={settingsForm.calendar_email}
                                onChange={event =>
                                    setSettingsForm(current => ({
                                        ...current,
                                        calendar_email: event.target.value
                                    }))
                                }
                            />
                            <small className="field__hint">
                                Estado actual: {settingsForm.google_calendar_connected ? 'Google Calendar conectado' : 'Google Calendar pendiente por configurar en .env'}
                            </small>
                        </label>

                        <button
                            className="button button--primary"
                            disabled={saveSettingsMutation.isPending}
                            type="submit"
                        >
                            {saveSettingsMutation.isPending
                                ? 'Guardando...'
                                : 'Guardar configuracion'}
                        </button>
                    </form>
                </article>
            </section>

            <ConfirmDialog
                open={Boolean(pendingCancel)}
                title="Cancelar cita"
                description={
                    pendingCancel
                        ? `Se cancelara la cita de ${pendingCancel.client_name} el ${formatDate(
                              pendingCancel.appointment_date
                          )} a las ${formatTime(pendingCancel.start_time)}.`
                        : ''
                }
                confirmLabel={cancelMutation.isPending ? 'Cancelando...' : 'Cancelar cita'}
                onCancel={() => setPendingCancel(null)}
                onConfirm={() => cancelMutation.mutate(pendingCancel)}
            />

            <AppointmentEditorDrawer
                open={Boolean(editingAppointment)}
                appointment={editingAppointment}
                isAdmin
                clientOptions={clientOptions}
                productOptions={productOptions}
                slotMinutes={settingsForm.slot_minutes}
                onClose={() => setEditingAppointment(null)}
                onSubmit={values => updateAppointmentMutation.mutate(values)}
                isPending={updateAppointmentMutation.isPending}
            />
        </div>
    );
}

export default function AppointmentsPage() {
    const user = getSessionUser();

    if (user.role !== 'admin') {
        return <UserAppointmentsPage />;
    }

    return <AdminAppointmentsPage />;
}
