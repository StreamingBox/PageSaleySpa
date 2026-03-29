import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { formatTime } from '../lib/format';
import DrawerForm from './DrawerForm';
import SearchableSelect from './SearchableSelect';

function createEditForm(appointment) {
    return {
        client_id: appointment ? String(appointment.client_id || '') : '',
        product_id: appointment ? String(appointment.product_id || '') : '',
        appointment_date: appointment?.appointment_date || '',
        duration_minutes: appointment
            ? String(appointment.appointment_duration_minutes || 60)
            : '60',
        start_time: appointment?.start_time || '',
        notes: appointment?.notes || ''
    };
}

export default function AppointmentEditorDrawer({
    open,
    appointment,
    isAdmin = false,
    clientOptions = [],
    productOptions = [],
    slotMinutes = 30,
    onClose,
    onSubmit,
    isPending = false
}) {
    const [form, setForm] = useState(createEditForm(appointment));

    useEffect(() => {
        if (!open) return;
        setForm(createEditForm(appointment));
    }, [appointment, open]);

    const availabilityQuery = useQuery({
        queryKey: [
            'appointment-edit-availability',
            appointment?.id || 'new',
            form.appointment_date,
            form.product_id,
            form.duration_minutes
        ],
        enabled: open && Boolean(form.appointment_date),
        queryFn: () =>
            apiFetch(
                `/api/appointments/availability?date=${encodeURIComponent(
                    form.appointment_date
                )}${
                    form.product_id
                        ? `&product_id=${encodeURIComponent(form.product_id)}`
                        : ''
                }${
                    form.duration_minutes
                        ? `&duration_minutes=${encodeURIComponent(form.duration_minutes)}`
                        : ''
                }${
                    appointment?.id
                        ? `&exclude_appointment_id=${encodeURIComponent(appointment.id)}`
                        : ''
                }`
            )
    });

    useEffect(() => {
        if (!open) return;

        const slots = availabilityQuery.data?.data?.slots || [];
        if (!slots.length) {
            setForm(current => ({ ...current, start_time: '' }));
            return;
        }

        const hasCurrentSlot = slots.some(slot => slot.start_time === form.start_time);
        if (!hasCurrentSlot) {
            setForm(current => ({ ...current, start_time: slots[0].start_time }));
        }
    }, [availabilityQuery.data, form.start_time, open]);

    const durationOptions = useMemo(() => {
        const step = Math.max(15, Number(slotMinutes || 30));
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

    if (!appointment) {
        return null;
    }

    return (
        <DrawerForm
            open={open}
            title={appointment.status === 'CANCELADA' ? 'Reagendar cita' : 'Editar cita'}
            description={`Actualiza la reserva de ${appointment.client_name || 'este cliente'}.`}
            eyebrow="Agenda"
            onClose={onClose}
            placement="centered"
        >
            <form
                className="stack-form"
                onSubmit={event => {
                    event.preventDefault();
                    onSubmit(form);
                }}
            >
                {isAdmin ? (
                    <label className="field">
                        <span>Cliente</span>
                        <SearchableSelect
                            value={form.client_id}
                            options={clientOptions}
                            placeholder="Selecciona un cliente"
                            searchPlaceholder="Busca por nombre, telefono o direccion"
                            emptyMessage="No encontre clientes."
                            onChange={nextValue =>
                                setForm(current => ({ ...current, client_id: nextValue }))
                            }
                        />
                    </label>
                ) : null}

                <label className="field">
                    <span>Servicio</span>
                    <SearchableSelect
                        value={form.product_id}
                        options={productOptions}
                        placeholder="Selecciona un servicio"
                        searchPlaceholder="Busca por nombre o duracion"
                        emptyMessage="No encontre servicios."
                        onChange={nextValue =>
                            setForm(current => ({
                                ...current,
                                product_id: nextValue,
                                start_time: ''
                            }))
                        }
                    />
                </label>

                <div className="form-grid">
                    <label className="field">
                        <span>Fecha</span>
                        <input
                            type="date"
                            value={form.appointment_date}
                            onChange={event =>
                                setForm(current => ({
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
                            value={form.duration_minutes}
                            onChange={event =>
                                setForm(current => ({
                                    ...current,
                                    duration_minutes: event.target.value,
                                    start_time: ''
                                }))
                            }
                        >
                            {durationOptions}
                        </select>
                    </label>
                </div>

                <label className="field">
                    <span>Hora disponible</span>
                    <select
                        value={form.start_time}
                        onChange={event =>
                            setForm(current => ({
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
                    {availabilityQuery.isLoading ? (
                        <small className="field__hint">Buscando disponibilidad...</small>
                    ) : null}
                    {availabilityQuery.isError ? (
                        <small className="field__hint">{availabilityQuery.error.message}</small>
                    ) : null}
                </label>

                <label className="field">
                    <span>Notas</span>
                    <textarea
                        rows="3"
                        value={form.notes}
                        onChange={event =>
                            setForm(current => ({
                                ...current,
                                notes: event.target.value
                            }))
                        }
                    />
                </label>

                <div className="page-actions">
                    <button
                        className="button button--ghost"
                        onClick={onClose}
                        type="button"
                    >
                        Cerrar
                    </button>
                    <button
                        className="button button--primary"
                        disabled={isPending}
                        type="submit"
                    >
                        {isPending
                            ? 'Guardando...'
                            : appointment.status === 'CANCELADA'
                              ? 'Reagendar'
                              : 'Guardar cambios'}
                    </button>
                </div>
            </form>
        </DrawerForm>
    );
}
