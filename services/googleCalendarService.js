const { google } = require('googleapis');

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getGoogleCalendarConfig() {
    return {
        clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
        clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        redirectUri: String(process.env.GOOGLE_REDIRECT_URI || '').trim(),
        refreshToken: String(process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
        calendarId: String(process.env.GOOGLE_CALENDAR_ID || 'primary').trim()
    };
}

function isGoogleCalendarConfigured() {
    const config = getGoogleCalendarConfig();
    return Boolean(
        config.clientId &&
            config.clientSecret &&
            config.redirectUri &&
            config.refreshToken &&
            config.calendarId
    );
}

function getOAuthClient() {
    const config = getGoogleCalendarConfig();
    const client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );

    client.setCredentials({
        refresh_token: config.refreshToken
    });

    return client;
}

function getCalendarClient() {
    if (!isGoogleCalendarConfigured()) {
        return null;
    }

    return google.calendar({
        version: 'v3',
        auth: getOAuthClient()
    });
}

function buildEventPayload(appointment, settings) {
    const location = settings.business_address || settings.business_name || '';
    const description = [
        `Cliente: ${appointment.client_name}`,
        appointment.client_phone ? `Telefono: ${appointment.client_phone}` : '',
        `Servicio: ${appointment.product_name}`,
        appointment.notes ? `Notas: ${appointment.notes}` : '',
        location ? `Direccion: ${location}` : ''
    ]
        .filter(Boolean)
        .join('\n');

    return {
        summary: `${settings.business_name || 'SaleySpa'} - ${appointment.client_name} - ${appointment.product_name}`,
        location,
        description,
        start: {
            dateTime: `${appointment.appointment_date}T${appointment.start_time}:00-05:00`,
            timeZone: 'America/Bogota'
        },
        end: {
            dateTime: `${appointment.appointment_date}T${appointment.end_time}:00-05:00`,
            timeZone: 'America/Bogota'
        }
    };
}

async function createCalendarEvent(appointment, settings) {
    const calendar = getCalendarClient();
    if (!calendar) {
        return { skipped: true };
    }

    const { calendarId } = getGoogleCalendarConfig();
    const response = await calendar.events.insert({
        calendarId,
        requestBody: buildEventPayload(appointment, settings)
    });

    return {
        eventId: response.data.id || '',
        htmlLink: response.data.htmlLink || ''
    };
}

async function updateCalendarEvent(eventId, appointment, settings) {
    const calendar = getCalendarClient();
    if (!calendar || !eventId) {
        return { skipped: true };
    }

    const { calendarId } = getGoogleCalendarConfig();
    const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: buildEventPayload(appointment, settings)
    });

    return {
        eventId: response.data.id || eventId,
        htmlLink: response.data.htmlLink || ''
    };
}

async function deleteCalendarEvent(eventId) {
    const calendar = getCalendarClient();
    if (!calendar || !eventId) {
        return { skipped: true };
    }

    const { calendarId } = getGoogleCalendarConfig();
    await calendar.events.delete({
        calendarId,
        eventId
    });

    return { deleted: true };
}

module.exports = {
    GOOGLE_SCOPES,
    createCalendarEvent,
    deleteCalendarEvent,
    getGoogleCalendarConfig,
    isGoogleCalendarConfigured,
    updateCalendarEvent
};
