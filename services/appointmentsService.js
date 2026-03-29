const pool = require('../config/db');
const { formatProperCase } = require('../utils/properCase');
const { ensureProductSchema } = require('./productsService');
const {
    createCalendarEvent,
    deleteCalendarEvent,
    isGoogleCalendarConfigured
} = require('./googleCalendarService');

const DEFAULT_SETTINGS = {
    day_start: '09:00',
    day_end: '18:00',
    slot_minutes: 30,
    lead_time_hours: 2,
    business_name: process.env.APPOINTMENTS_BUSINESS_NAME || 'SaleySpa',
    business_address:
        process.env.APPOINTMENTS_BUSINESS_ADDRESS || 'Bogota, Colombia',
    calendar_email: process.env.APPOINTMENTS_CALENDAR_EMAIL || ''
};

let ensurePromise = null;

function normalizeDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
}

function normalizeTime(value) {
    const match = String(value || '')
        .trim()
        .match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

    if (!match) return '';
    return `${match[1]}:${match[2]}`;
}

function timeToMinutes(value) {
    const normalized = normalizeTime(value);
    if (!normalized) return NaN;

    const [hours, minutes] = normalized.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, '0');
    const minutes = Math.floor(totalMinutes % 60)
        .toString()
        .padStart(2, '0');

    return `${hours}:${minutes}`;
}

function normalizeAppointmentDuration(value, slotMinutes = 30) {
    const numericValue = Number(value || 0);
    const safeSlot = Math.max(15, Number(slotMinutes || 30));

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return safeSlot;
    }

    const rounded = Math.round(numericValue / safeSlot) * safeSlot;
    return Math.min(240, Math.max(safeSlot, rounded));
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
    return leftStart < rightEnd && rightStart < leftEnd;
}

function buildGoogleMapsUrl(address) {
    if (!address) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function buildGoogleCalendarUrl(appointment, settings) {
    if (!appointment?.appointment_date || !appointment?.start_time || !appointment?.end_time) {
        return '';
    }

    const start = `${appointment.appointment_date.replaceAll('-', '')}T${appointment.start_time.replace(':', '')}00`;
    const end = `${appointment.appointment_date.replaceAll('-', '')}T${appointment.end_time.replace(':', '')}00`;
    const text = encodeURIComponent(
        `${settings.business_name} - ${appointment.client_name} - ${appointment.product_name}`
    );
    const details = encodeURIComponent(
        [
            `Cliente: ${appointment.client_name}`,
            `Servicio: ${appointment.product_name}`,
            appointment.notes ? `Notas: ${appointment.notes}` : '',
            settings.business_address ? `Direccion: ${settings.business_address}` : ''
        ]
            .filter(Boolean)
            .join('\n')
    );
    const location = encodeURIComponent(settings.business_address || settings.business_name);
    const calendarEmail = settings.calendar_email
        ? `&add=${encodeURIComponent(settings.calendar_email)}`
        : '';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}&ctz=America/Bogota${calendarEmail}`;
}

function mapSettings(row) {
    return {
        day_start: normalizeTime(row.day_start) || DEFAULT_SETTINGS.day_start,
        day_end: normalizeTime(row.day_end) || DEFAULT_SETTINGS.day_end,
        slot_minutes: Number(row.slot_minutes || DEFAULT_SETTINGS.slot_minutes),
        lead_time_hours: Number(row.lead_time_hours || DEFAULT_SETTINGS.lead_time_hours),
        business_name: row.business_name || DEFAULT_SETTINGS.business_name,
        business_address: row.business_address || DEFAULT_SETTINGS.business_address,
        calendar_email: row.calendar_email || '',
        google_calendar_connected: isGoogleCalendarConfigured()
    };
}

function mapBlock(row) {
    return {
        id: Number(row.id),
        block_date: row.block_date ? new Date(row.block_date).toISOString().slice(0, 10) : '',
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        reason: row.reason || ''
    };
}

function mapAppointment(row, settings) {
    const mapped = {
        id: Number(row.id),
        client_id: Number(row.client_id),
        product_id: Number(row.product_id),
        client_name: formatProperCase(row.client_name),
        client_phone: row.client_phone || '',
        product_name: formatProperCase(row.product_name),
        product_duration_minutes: Number(row.product_duration_minutes || 0),
        appointment_duration_minutes:
            Math.max(
                0,
                timeToMinutes(row.end_time) - timeToMinutes(row.start_time)
            ) || Number(row.product_duration_minutes || 0),
        appointment_date: row.appointment_date
            ? new Date(row.appointment_date).toISOString().slice(0, 10)
            : '',
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        status: row.status || 'PROGRAMADA',
        notes: row.notes || '',
        cancel_reason: row.cancel_reason || '',
        created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
        cancelled_at: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : '',
        google_event_id: row.google_event_id || '',
        google_event_html_link: row.google_event_html_link || '',
        google_sync_status: row.google_sync_status || 'PENDIENTE',
        google_sync_error: row.google_sync_error || ''
    };

    return {
        ...mapped,
        google_maps_url: buildGoogleMapsUrl(settings.business_address),
        google_calendar_url: mapped.google_event_html_link || buildGoogleCalendarUrl(mapped, settings),
        google_calendar_connected: isGoogleCalendarConfigured()
    };
}

async function getAppointmentRecord(id, clientId = '') {
    const params = [Number(id)];
    const clientFilter = Number(clientId) > 0 ? ' AND a.client_id = ?' : '';

    if (Number(clientId) > 0) {
        params.push(Number(clientId));
    }

    const [rows] = await pool.execute(
        `
            SELECT
                a.*,
                c.name AS client_name,
                c.phone AS client_phone,
                p.name AS product_name,
                p.duration_minutes AS product_duration_minutes
              FROM appointments a
              JOIN clients c ON c.id = a.client_id
              JOIN products p ON p.id = a.product_id
             WHERE a.id = ?
             ${clientFilter}
             LIMIT 1
        `,
        params
    );

    return rows[0] || null;
}

async function ensureAppointmentsSchema() {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        await ensureProductSchema();

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointment_settings (
                id TINYINT NOT NULL PRIMARY KEY,
                day_start TIME NOT NULL,
                day_end TIME NOT NULL,
                slot_minutes INT NOT NULL DEFAULT 30,
                lead_time_hours INT NOT NULL DEFAULT 2,
                business_name VARCHAR(120) NOT NULL,
                business_address VARCHAR(255) NOT NULL,
                calendar_email VARCHAR(160) NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointment_blocks (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                block_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                reason VARCHAR(255) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_appointment_blocks_date (block_date)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                product_id INT NOT NULL,
                appointment_date DATE NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                status VARCHAR(24) NOT NULL DEFAULT 'PROGRAMADA',
                notes TEXT NULL,
                cancel_reason VARCHAR(255) NULL,
                cancelled_at DATETIME NULL,
                google_event_id VARCHAR(255) NULL,
                google_event_html_link TEXT NULL,
                google_sync_status VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE',
                google_sync_error TEXT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_appointments_date_status (appointment_date, status),
                INDEX idx_appointments_client (client_id),
                INDEX idx_appointments_product (product_id)
            )
        `);

        const appointmentColumns = [
            {
                name: 'google_event_id',
                ddl: `ALTER TABLE appointments ADD COLUMN google_event_id VARCHAR(255) NULL AFTER cancelled_at`
            },
            {
                name: 'google_event_html_link',
                ddl: `ALTER TABLE appointments ADD COLUMN google_event_html_link TEXT NULL AFTER google_event_id`
            },
            {
                name: 'google_sync_status',
                ddl: `ALTER TABLE appointments ADD COLUMN google_sync_status VARCHAR(24) NOT NULL DEFAULT 'PENDIENTE' AFTER google_event_html_link`
            },
            {
                name: 'google_sync_error',
                ddl: `ALTER TABLE appointments ADD COLUMN google_sync_error TEXT NULL AFTER google_sync_status`
            }
        ];

        for (const column of appointmentColumns) {
            const [rows] = await pool.query(
                `SHOW COLUMNS FROM appointments LIKE ?`,
                [column.name]
            );

            if (!rows.length) {
                await pool.query(column.ddl);
            }
        }

        await pool.query(
            `
                INSERT INTO appointment_settings (
                    id,
                    day_start,
                    day_end,
                    slot_minutes,
                    lead_time_hours,
                    business_name,
                    business_address,
                    calendar_email
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE id = id
            `,
            [
                DEFAULT_SETTINGS.day_start,
                DEFAULT_SETTINGS.day_end,
                DEFAULT_SETTINGS.slot_minutes,
                DEFAULT_SETTINGS.lead_time_hours,
                DEFAULT_SETTINGS.business_name,
                DEFAULT_SETTINGS.business_address,
                DEFAULT_SETTINGS.calendar_email
            ]
        );
    })();

    try {
        await ensurePromise;
    } catch (error) {
        ensurePromise = null;
        throw error;
    }
}

async function setAppointmentGoogleSync(id, values) {
    await pool.execute(
        `
            UPDATE appointments
               SET google_event_id = ?,
                   google_event_html_link = ?,
                   google_sync_status = ?,
                   google_sync_error = ?
             WHERE id = ?
        `,
        [
            values.google_event_id || null,
            values.google_event_html_link || null,
            values.google_sync_status || 'PENDIENTE',
            values.google_sync_error || null,
            Number(id)
        ]
    );
}

async function getAppointmentSettings() {
    await ensureAppointmentsSchema();
    const [rows] = await pool.query('SELECT * FROM appointment_settings WHERE id = 1 LIMIT 1');
    return mapSettings(rows[0] || DEFAULT_SETTINGS);
}

async function updateAppointmentSettings(values) {
    await ensureAppointmentsSchema();

    const nextSettings = {
        day_start: normalizeTime(values.day_start) || DEFAULT_SETTINGS.day_start,
        day_end: normalizeTime(values.day_end) || DEFAULT_SETTINGS.day_end,
        slot_minutes: Math.max(15, Number(values.slot_minutes || DEFAULT_SETTINGS.slot_minutes)),
        lead_time_hours: Math.max(
            1,
            Number(values.lead_time_hours || DEFAULT_SETTINGS.lead_time_hours)
        ),
        business_name: String(values.business_name || DEFAULT_SETTINGS.business_name).trim(),
        business_address: String(
            values.business_address || DEFAULT_SETTINGS.business_address
        ).trim(),
        calendar_email: String(values.calendar_email || '').trim()
    };

    if (timeToMinutes(nextSettings.day_end) <= timeToMinutes(nextSettings.day_start)) {
        throw new Error('La hora final debe ser mayor a la hora inicial');
    }

    await pool.execute(
        `
            UPDATE appointment_settings
               SET day_start = ?,
                   day_end = ?,
                   slot_minutes = ?,
                   lead_time_hours = ?,
                   business_name = ?,
                   business_address = ?,
                   calendar_email = ?
             WHERE id = 1
        `,
        [
            nextSettings.day_start,
            nextSettings.day_end,
            nextSettings.slot_minutes,
            nextSettings.lead_time_hours,
            nextSettings.business_name,
            nextSettings.business_address,
            nextSettings.calendar_email || null
        ]
    );

    return getAppointmentSettings();
}

async function getProductDuration(productId) {
    const [rows] = await pool.execute(
        'SELECT id, duration_minutes FROM products WHERE id = ? LIMIT 1',
        [productId]
    );

    return rows.length ? Math.max(15, Number(rows[0].duration_minutes || 60)) : 60;
}

async function entityExists(table, id) {
    const [rows] = await pool.execute(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    return rows.length > 0;
}

async function getScheduleConflicts(date, excludedAppointmentId = '') {
    const safeDate = normalizeDate(date);
    const appointmentParams = [safeDate];
    const appointmentExclusion =
        Number(excludedAppointmentId) > 0 ? ' AND id <> ?' : '';

    if (Number(excludedAppointmentId) > 0) {
        appointmentParams.push(Number(excludedAppointmentId));
    }

    const [appointmentRows] = await pool.execute(
        `
            SELECT start_time, end_time
              FROM appointments
             WHERE appointment_date = ?
               AND status <> 'CANCELADA'
               ${appointmentExclusion}
        `,
        appointmentParams
    );
    const [blockRows] = await pool.execute(
        `
            SELECT start_time, end_time
              FROM appointment_blocks
             WHERE block_date = ?
        `,
        [safeDate]
    );

    return {
        appointments: appointmentRows.map(row => ({
            start: timeToMinutes(row.start_time),
            end: timeToMinutes(row.end_time)
        })),
        blocks: blockRows.map(row => ({
            start: timeToMinutes(row.start_time),
            end: timeToMinutes(row.end_time)
        }))
    };
}

async function listAppointmentAvailability(
    date,
    productId,
    durationMinutesInput,
    excludedAppointmentId = ''
) {
    await ensureAppointmentsSchema();

    const safeDate = normalizeDate(date);
    if (!safeDate) {
        throw new Error('Selecciona una fecha valida');
    }

    const settings = await getAppointmentSettings();
    const baseDurationMinutes = productId
        ? await getProductDuration(Number(productId))
        : settings.slot_minutes;
    const durationMinutes = normalizeAppointmentDuration(
        durationMinutesInput || baseDurationMinutes,
        settings.slot_minutes
    );
    const scheduleStart = timeToMinutes(settings.day_start);
    const scheduleEnd = timeToMinutes(settings.day_end);
    const { appointments, blocks } = await getScheduleConflicts(
        safeDate,
        excludedAppointmentId
    );
    const slots = [];
    const nowWithLeadTime = Date.now() + settings.lead_time_hours * 60 * 60 * 1000;

    for (
        let cursor = scheduleStart;
        cursor + durationMinutes <= scheduleEnd;
        cursor += settings.slot_minutes
    ) {
        const slotEnd = cursor + durationMinutes;
        const slotDateTime = new Date(`${safeDate}T${minutesToTime(cursor)}:00`);
        const blocked = [...appointments, ...blocks].some(range =>
            rangesOverlap(cursor, slotEnd, range.start, range.end)
        );

        if (!blocked && slotDateTime.getTime() >= nowWithLeadTime) {
            slots.push({
                start_time: minutesToTime(cursor),
                end_time: minutesToTime(slotEnd),
                duration_minutes: durationMinutes
            });
        }
    }

    const [blockRows] = await pool.execute(
        `
            SELECT *
              FROM appointment_blocks
             WHERE block_date = ?
             ORDER BY start_time
        `,
        [safeDate]
    );

    return {
        settings,
        date: safeDate,
        duration_minutes: durationMinutes,
        slots,
        blocks: blockRows.map(mapBlock)
    };
}

async function listAppointments({
    date = '',
    status = '',
    startDate = '',
    limit = 0,
    clientId = ''
} = {}) {
    await ensureAppointmentsSchema();

    const settings = await getAppointmentSettings();
    const params = [];
    const conditions = [];

    if (normalizeDate(date)) {
        conditions.push('a.appointment_date = ?');
        params.push(normalizeDate(date));
    }

    if (status) {
        conditions.push('a.status = ?');
        params.push(String(status).trim().toUpperCase());
    }

    if (normalizeDate(startDate)) {
        conditions.push('a.appointment_date >= ?');
        params.push(normalizeDate(startDate));
    }

    if (Number(clientId) > 0) {
        conditions.push('a.client_id = ?');
        params.push(Number(clientId));
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.max(0, Number(limit || 0));
    const [rows] = await pool.execute(
        `
            SELECT
                a.*,
                c.name AS client_name,
                c.phone AS client_phone,
                p.name AS product_name,
                p.duration_minutes AS product_duration_minutes
              FROM appointments a
              JOIN clients c ON c.id = a.client_id
              JOIN products p ON p.id = a.product_id
              ${whereClause}
             ORDER BY a.appointment_date ASC, a.start_time ASC, a.id ASC
             ${safeLimit ? `LIMIT ${safeLimit}` : ''}
        `,
        params
    );

    return rows.map(row => mapAppointment(row, settings));
}

async function getAppointmentById(id, options = {}) {
    await ensureAppointmentsSchema();

    const settings = await getAppointmentSettings();
    const row = await getAppointmentRecord(id, options.clientId || '');

    return row ? mapAppointment(row, settings) : null;
}

async function createAppointment({
    client_id,
    product_id,
    appointment_date,
    start_time,
    duration_minutes,
    notes = ''
}) {
    await ensureAppointmentsSchema();

    const settings = await getAppointmentSettings();
    const safeDate = normalizeDate(appointment_date);
    const safeTime = normalizeTime(start_time);
    const clientId = Number(client_id);
    const productId = Number(product_id);

    if (!clientId || !productId || !safeDate || !safeTime) {
        throw new Error('Completa cliente, servicio, fecha y hora');
    }

    if (!(await entityExists('clients', clientId))) {
        throw new Error('El cliente seleccionado no existe');
    }

    if (!(await entityExists('products', productId))) {
        throw new Error('El servicio seleccionado no existe');
    }

    const productDurationMinutes = await getProductDuration(productId);
    const durationMinutes = normalizeAppointmentDuration(
        duration_minutes || productDurationMinutes,
        settings.slot_minutes
    );
    const startMinutes = timeToMinutes(safeTime);
    const endMinutes = startMinutes + durationMinutes;

    if (startMinutes < timeToMinutes(settings.day_start) || endMinutes > timeToMinutes(settings.day_end)) {
        throw new Error('La cita queda fuera del horario disponible');
    }

    const appointmentDateTime = new Date(`${safeDate}T${safeTime}:00`);
    const leadTimeMs = settings.lead_time_hours * 60 * 60 * 1000;

    if (appointmentDateTime.getTime() - Date.now() < leadTimeMs) {
        throw new Error(
            `La cita debe reservarse con al menos ${settings.lead_time_hours} horas de anticipacion`
        );
    }

    const { appointments, blocks } = await getScheduleConflicts(safeDate);
    const overlaps = [...appointments, ...blocks].some(range =>
        rangesOverlap(startMinutes, endMinutes, range.start, range.end)
    );

    if (overlaps) {
        throw new Error('Ese horario ya no esta disponible');
    }

    const [result] = await pool.execute(
        `
            INSERT INTO appointments (
                client_id,
                product_id,
                appointment_date,
                start_time,
                end_time,
                status,
                notes
            )
            VALUES (?, ?, ?, ?, ?, 'PROGRAMADA', ?)
        `,
        [clientId, productId, safeDate, safeTime, minutesToTime(endMinutes), String(notes || '').trim() || null]
    );

    const appointment = mapAppointment(
        await getAppointmentRecord(result.insertId),
        settings
    );

    if (!isGoogleCalendarConfigured()) {
        return appointment;
    }

    try {
        const calendarEvent = await createCalendarEvent(appointment, settings);

        if (!calendarEvent.skipped) {
            await setAppointmentGoogleSync(appointment.id, {
                google_event_id: calendarEvent.eventId,
                google_event_html_link: calendarEvent.htmlLink,
                google_sync_status: 'SINCRONIZADA',
                google_sync_error: ''
            });

            return {
                ...appointment,
                google_event_id: calendarEvent.eventId,
                google_event_html_link: calendarEvent.htmlLink,
                google_calendar_url: calendarEvent.htmlLink || appointment.google_calendar_url,
                google_sync_status: 'SINCRONIZADA',
                google_sync_error: ''
            };
        }
    } catch (error) {
        await setAppointmentGoogleSync(appointment.id, {
            google_event_id: '',
            google_event_html_link: '',
            google_sync_status: 'ERROR',
            google_sync_error: error.message
        });

        return {
            ...appointment,
            google_sync_status: 'ERROR',
            google_sync_error: error.message
        };
    }

    return appointment;
}

async function updateAppointment(id, values = {}) {
    await ensureAppointmentsSchema();

    const appointmentId = Number(id);
    const existingAppointment = await getAppointmentRecord(appointmentId);

    if (!existingAppointment) {
        return null;
    }

    if (existingAppointment.status === 'ATENDIDA') {
        throw new Error('Una cita atendida no se puede editar ni reagendar');
    }

    const settings = await getAppointmentSettings();
    const safeDate = normalizeDate(
        values.appointment_date || existingAppointment.appointment_date
    );
    const safeTime = normalizeTime(values.start_time || existingAppointment.start_time);
    const clientId = Number(values.client_id || existingAppointment.client_id);
    const productId = Number(values.product_id || existingAppointment.product_id);

    if (!clientId || !productId || !safeDate || !safeTime) {
        throw new Error('Completa cliente, servicio, fecha y hora');
    }

    if (!(await entityExists('clients', clientId))) {
        throw new Error('El cliente seleccionado no existe');
    }

    if (!(await entityExists('products', productId))) {
        throw new Error('El servicio seleccionado no existe');
    }

    const productDurationMinutes = await getProductDuration(productId);
    const durationMinutes = normalizeAppointmentDuration(
        values.duration_minutes || productDurationMinutes,
        settings.slot_minutes
    );
    const startMinutes = timeToMinutes(safeTime);
    const endMinutes = startMinutes + durationMinutes;

    if (
        startMinutes < timeToMinutes(settings.day_start) ||
        endMinutes > timeToMinutes(settings.day_end)
    ) {
        throw new Error('La cita queda fuera del horario disponible');
    }

    const appointmentDateTime = new Date(`${safeDate}T${safeTime}:00`);
    const leadTimeMs = settings.lead_time_hours * 60 * 60 * 1000;

    if (appointmentDateTime.getTime() - Date.now() < leadTimeMs) {
        throw new Error(
            `La cita debe reservarse con al menos ${settings.lead_time_hours} horas de anticipacion`
        );
    }

    const { appointments, blocks } = await getScheduleConflicts(
        safeDate,
        appointmentId
    );
    const overlaps = [...appointments, ...blocks].some(range =>
        rangesOverlap(startMinutes, endMinutes, range.start, range.end)
    );

    if (overlaps) {
        throw new Error('Ese horario ya no esta disponible');
    }

    await pool.execute(
        `
            UPDATE appointments
               SET client_id = ?,
                   product_id = ?,
                   appointment_date = ?,
                   start_time = ?,
                   end_time = ?,
                   status = 'PROGRAMADA',
                   notes = ?,
                   cancel_reason = NULL,
                   cancelled_at = NULL
             WHERE id = ?
        `,
        [
            clientId,
            productId,
            safeDate,
            safeTime,
            minutesToTime(endMinutes),
            String(values.notes ?? existingAppointment.notes ?? '').trim() || null,
            appointmentId
        ]
    );

    const updatedAppointment = mapAppointment(
        await getAppointmentRecord(appointmentId),
        settings
    );

    if (!isGoogleCalendarConfigured()) {
        return updatedAppointment;
    }

    try {
        if (existingAppointment.google_event_id) {
            await deleteCalendarEvent(existingAppointment.google_event_id);
        }

        const calendarEvent = await createCalendarEvent(updatedAppointment, settings);

        if (!calendarEvent.skipped) {
            await setAppointmentGoogleSync(updatedAppointment.id, {
                google_event_id: calendarEvent.eventId,
                google_event_html_link: calendarEvent.htmlLink,
                google_sync_status: 'SINCRONIZADA',
                google_sync_error: ''
            });

            return {
                ...updatedAppointment,
                google_event_id: calendarEvent.eventId,
                google_event_html_link: calendarEvent.htmlLink,
                google_calendar_url:
                    calendarEvent.htmlLink || updatedAppointment.google_calendar_url,
                google_sync_status: 'SINCRONIZADA',
                google_sync_error: ''
            };
        }

        await setAppointmentGoogleSync(updatedAppointment.id, {
            google_event_id: '',
            google_event_html_link: '',
            google_sync_status: 'PENDIENTE',
            google_sync_error: ''
        });

        return {
            ...updatedAppointment,
            google_event_id: '',
            google_event_html_link: '',
            google_sync_status: 'PENDIENTE',
            google_sync_error: ''
        };
    } catch (error) {
        await setAppointmentGoogleSync(updatedAppointment.id, {
            google_event_id: '',
            google_event_html_link: '',
            google_sync_status: 'ERROR',
            google_sync_error: error.message
        });

        return {
            ...updatedAppointment,
            google_event_id: '',
            google_event_html_link: '',
            google_sync_status: 'ERROR',
            google_sync_error: error.message
        };
    }
}

async function confirmAppointment(id) {
    await ensureAppointmentsSchema();

    await pool.execute(
        `
            UPDATE appointments
               SET status = 'ATENDIDA'
             WHERE id = ?
               AND status = 'PROGRAMADA'
        `,
        [Number(id)]
    );

    const settings = await getAppointmentSettings();
    const row = await getAppointmentRecord(id);

    return row ? mapAppointment(row, settings) : null;
}

async function cancelAppointment(id, reason = '') {
    await ensureAppointmentsSchema();

    const existingAppointment = await getAppointmentRecord(id);

    if (!existingAppointment) {
        return null;
    }

    await pool.execute(
        `
            UPDATE appointments
               SET status = 'CANCELADA',
                   cancel_reason = ?,
                   cancelled_at = NOW()
             WHERE id = ?
        `,
        [String(reason || '').trim() || null, Number(id)]
    );

    const settings = await getAppointmentSettings();
    const appointment = mapAppointment(existingAppointment, settings);

    if (appointment.google_event_id && isGoogleCalendarConfigured()) {
        try {
            await deleteCalendarEvent(appointment.google_event_id);
            await setAppointmentGoogleSync(appointment.id, {
                google_event_id: '',
                google_event_html_link: '',
                google_sync_status: 'CANCELADA',
                google_sync_error: ''
            });
        } catch (error) {
            await setAppointmentGoogleSync(appointment.id, {
                google_event_id: appointment.google_event_id,
                google_event_html_link: appointment.google_event_html_link,
                google_sync_status: 'ERROR',
                google_sync_error: error.message
            });
        }
    }

    const updatedRow = await getAppointmentRecord(id);

    return updatedRow ? mapAppointment(updatedRow, settings) : null;
}

async function createAppointmentBlock({ block_date, start_time, end_time, reason = '' }) {
    await ensureAppointmentsSchema();

    const safeDate = normalizeDate(block_date);
    const safeStart = normalizeTime(start_time);
    const safeEnd = normalizeTime(end_time);
    const settings = await getAppointmentSettings();

    if (!safeDate || !safeStart || !safeEnd) {
        throw new Error('Completa fecha, hora inicial y hora final');
    }

    if (timeToMinutes(safeEnd) <= timeToMinutes(safeStart)) {
        throw new Error('La hora final del bloqueo debe ser mayor a la inicial');
    }

    if (
        timeToMinutes(safeStart) < timeToMinutes(settings.day_start) ||
        timeToMinutes(safeEnd) > timeToMinutes(settings.day_end)
    ) {
        throw new Error('El bloqueo debe estar dentro del horario operativo configurado');
    }

    const { appointments } = await getScheduleConflicts(safeDate);
    const blockStart = timeToMinutes(safeStart);
    const blockEnd = timeToMinutes(safeEnd);
    const overlapsAppointment = appointments.some(range =>
        rangesOverlap(blockStart, blockEnd, range.start, range.end)
    );

    if (overlapsAppointment) {
        throw new Error('No puedes bloquear un rango que ya tiene citas activas');
    }

    await pool.execute(
        `
            INSERT INTO appointment_blocks (block_date, start_time, end_time, reason)
            VALUES (?, ?, ?, ?)
        `,
        [safeDate, safeStart, safeEnd, String(reason || '').trim() || null]
    );

    return listAppointmentAvailability(safeDate);
}

async function deleteAppointmentBlock(id, date) {
    await ensureAppointmentsSchema();
    await pool.execute('DELETE FROM appointment_blocks WHERE id = ?', [Number(id)]);
    return normalizeDate(date) ? listAppointmentAvailability(date) : { ok: true };
}

async function getAppointmentSummary(referenceDate = '', clientId = '') {
    await ensureAppointmentsSchema();

    const safeDate = normalizeDate(referenceDate) || new Date().toISOString().slice(0, 10);
    const params = [safeDate, safeDate];
    const clientFilter = Number(clientId) > 0 ? ' AND client_id = ?' : '';

    if (Number(clientId) > 0) {
        params.push(Number(clientId));
    }

    const [[stats]] = await pool.execute(
        `
            SELECT
                SUM(CASE WHEN status = 'PROGRAMADA' THEN 1 ELSE 0 END) AS scheduled_count,
                SUM(CASE WHEN status = 'CANCELADA' THEN 1 ELSE 0 END) AS cancelled_count,
                SUM(CASE WHEN DATE(created_at) = ? AND status = 'PROGRAMADA' THEN 1 ELSE 0 END) AS created_today_count
              FROM appointments
             WHERE appointment_date >= ?
             ${clientFilter}
        `,
        params
    );

    const todayParams = [safeDate];
    if (Number(clientId) > 0) {
        todayParams.push(Number(clientId));
    }
    const [[today]] = await pool.execute(
        `
            SELECT COUNT(*) AS today_count
              FROM appointments
             WHERE appointment_date = ?
               AND status = 'PROGRAMADA'
               ${Number(clientId) > 0 ? 'AND client_id = ?' : ''}
        `,
        todayParams
    );

    const [[blocks]] = await pool.execute(
        `
            SELECT COUNT(*) AS blocked_count
              FROM appointment_blocks
             WHERE block_date >= ?
        `,
        [safeDate]
    );

    return {
        scheduled_count: Number(stats?.scheduled_count || 0),
        cancelled_count: Number(stats?.cancelled_count || 0),
        created_today_count: Number(stats?.created_today_count || 0),
        today_count: Number(today?.today_count || 0),
        blocked_count: Number(blocks?.blocked_count || 0)
    };
}

module.exports = {
    cancelAppointment,
    confirmAppointment,
    createAppointment,
    createAppointmentBlock,
    deleteAppointmentBlock,
    getAppointmentById,
    getAppointmentSettings,
    getAppointmentSummary,
    listAppointmentAvailability,
    listAppointments,
    updateAppointment,
    updateAppointmentSettings
};
