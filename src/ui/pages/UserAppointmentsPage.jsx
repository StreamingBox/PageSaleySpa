import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, PencilLine } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate, formatTime, todayIso } from '../lib/format';
import SearchableSelect from '../components/SearchableSelect';
import EmptyState from '../components/EmptyState';
import KpiCard from '../components/KpiCard';
import AppointmentEditorDrawer from '../components/AppointmentEditorDrawer';
import { useToast } from '../components/Toast';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

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

function createBookingForm(defaultDate) {
    return {
        product_id: '',
        appointment_date: defaultDate,
        duration_minutes: '60',
        start_time: '',
        notes: ''
    };
}

export default function UserAppointmentsPage() {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const initialDate = todayIso();
    const [filterDate, setFilterDate] = useState(initialDate);
    const [bookingForm, setBookingForm] = useState(createBookingForm(initialDate));
    const [editingAppointment, setEditingAppointment] = useState(null);

    const settingsQuery = useQuery({
        queryKey: ['appointment-settings'],
        queryFn: () => apiFetch('/api/appointments/settings')
    });

    const summaryQuery = useQuery({
        queryKey: ['appointment-summary', filterDate],
        queryFn: () => apiFetch(`/api/appointments/summary?date=${encodeURIComponent(filterDate)}`)
    });

    const productsQuery = useQuery({
        queryKey: ['products', 'appointment-booking'],
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
        queryKey: ['my-appointments', filterDate],
        queryFn: () => apiFetch(`/api/appointments?date=${encodeURIComponent(filterDate)}`)
    });

    useEffect(() => {
        if (settingsQuery.data?.data) {
            setBookingForm(current => ({
                ...current,
                duration_minutes:
                    current.duration_minutes || String(settingsQuery.data.data.slot_minutes || 30)
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

    const bookAppointmentMutation = useMutation({
        mutationFn: values =>
            apiFetch('/api/appointments', {
                method: 'POST',
                body: values
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-availability'] });
            await queryClient.invalidateQueries({ queryKey: ['appointment-summary'] });
            showToast('Cita agendada correctamente', 'success');
            setBookingForm(current => ({
                ...createBookingForm(current.appointment_date),
                product_id: current.product_id,
                duration_minutes: current.duration_minutes
            }));
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
            await queryClient.invalidateQueries({ queryKey: ['my-appointments'] });
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

    const products = productsQuery.data?.data || [];
    const summary = summaryQuery.data?.data;
    const appointments = appointmentsQuery.data?.data || [];
    const selectedProduct = products.find(
        product => String(product.id) === String(bookingForm.product_id)
    );
    const productOptions = useMemo(() => buildProductOptions(products), [products]);
    const slotMinutes = Number(settingsQuery.data?.data?.slot_minutes || 30);
    const durationOptions = useMemo(() => {
        const step = Math.max(15, slotMinutes);
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
    }, [slotMinutes]);

    return (
        <div className="page-stack">
            <section className="hero">
                <div>
                    <p className="hero__eyebrow">Tu agenda</p>
                    <h3>Mis citas</h3>
                    <p className="hero__text">
                        Agenda una nueva cita y consulta el estado de tus reservas.
                    </p>
                </div>
            </section>

            <section className="kpi-grid">
                <KpiCard
                    label="Programadas"
                    value={summary ? String(summary.scheduled_count) : '0'}
                    note="Reservas activas desde la fecha consultada"
                />
                <KpiCard
                    label="Creadas hoy"
                    value={summary ? String(summary.created_today_count) : '0'}
                    note="Nuevas solicitudes registradas hoy"
                    accent="cyan"
                />
                <KpiCard
                    label="Para este dia"
                    value={summary ? String(summary.today_count) : '0'}
                    note="Citas activas en la fecha consultada"
                    accent="success"
                />
            </section>

            <section className="appointments-grid appointments-grid--workspace">
                <article className="panel appointments-panel appointments-panel--booking">
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
                                            nextProduct?.duration_minutes || slotMinutes
                                        ),
                                        start_time: ''
                                    }));
                                }}
                            />
                            <small className="field__hint">
                                {selectedProduct
                                    ? `Base del servicio: ${selectedProduct.duration_minutes} minutos`
                                    : 'Selecciona el servicio que deseas agendar.'}
                            </small>
                        </label>

                        <label className="field">
                            <span>Fecha</span>
                            <input
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
                        </label>

                        <label className="field">
                            <span>Duracion</span>
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
                        </label>

                        <label className="field">
                            <span>Hora disponible</span>
                            <select
                                value={bookingForm.start_time}
                                onChange={event =>
                                    setBookingForm(current => ({
                                        ...current,
                                        start_time: event.target.value
                                    }))
                                }
                            >
                                <option value="">Selecciona un horario</option>
                                {(availabilityQuery.data?.data?.slots || []).map(slot => (
                                    <option key={slot.start_time} value={slot.start_time}>
                                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                    </option>
                                ))}
                            </select>
                        </label>

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
                            disabled={bookAppointmentMutation.isPending}
                            type="submit"
                        >
                            <CalendarDays size={16} />
                            {bookAppointmentMutation.isPending ? 'Agendando...' : 'Agendar cita'}
                        </button>
                    </form>
                </article>

                <article className="panel appointments-panel appointments-panel--list">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Seguimiento</p>
                            <h3>Mis citas</h3>
                        </div>
                    </div>

                    <label className="field">
                        <span>Fecha</span>
                        <input
                            type="date"
                            value={filterDate}
                            onChange={event => setFilterDate(event.target.value)}
                        />
                    </label>

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
                                            <h4>{appointment.product_name}</h4>
                                            <p>
                                                {formatDate(appointment.appointment_date)} ·{' '}
                                                {formatTime(appointment.start_time)} -{' '}
                                                {formatTime(appointment.end_time)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="appointment-card__meta">
                                        <span>
                                            <Clock3 size={14} />{' '}
                                            {appointment.appointment_duration_minutes} min
                                        </span>
                                    </div>

                                    {appointment.status !== 'ATENDIDA' ? (
                                        <div className="appointment-card__actions">
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
                                        </div>
                                    ) : null}

                                    {appointment.notes ? (
                                        <p className="appointment-card__notes">{appointment.notes}</p>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="Sin citas para esta fecha"
                            description="Todavia no tienes reservas registradas en la fecha seleccionada."
                        />
                    )}
                </article>
            </section>

            <AppointmentEditorDrawer
                open={Boolean(editingAppointment)}
                appointment={editingAppointment}
                productOptions={productOptions}
                slotMinutes={slotMinutes}
                onClose={() => setEditingAppointment(null)}
                onSubmit={values => updateAppointmentMutation.mutate(values)}
                isPending={updateAppointmentMutation.isPending}
            />
        </div>
    );
}
