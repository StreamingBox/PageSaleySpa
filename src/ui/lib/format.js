import { addDays, format, parseISO, startOfMonth, subDays } from 'date-fns';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});
const timeFormatter = new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
});

export function formatMoney(value) {
    return moneyFormatter.format(Number(value || 0));
}

export function formatDate(value) {
    if (!value) return 'Sin fecha';
    return dateFormatter.format(parseISO(value));
}

export function formatTime(value) {
    if (!value) return '';
    return timeFormatter.format(parseISO(`2000-01-01T${String(value).slice(0, 5)}:00`));
}

export function todayIso() {
    return format(new Date(), 'yyyy-MM-dd');
}

export function startOfMonthIso() {
    return format(startOfMonth(new Date()), 'yyyy-MM-dd');
}

export function daysAgoIso(days) {
    return format(subDays(new Date(), days), 'yyyy-MM-dd');
}

export function saleWindowStartIso() {
    return daysAgoIso(30);
}

export function isSaleDateWithinWindow(
    value,
    minDate = saleWindowStartIso(),
    maxDate = todayIso()
) {
    if (!value) return false;
    return value >= minDate && value <= maxDate;
}

export function serializeParams(values) {
    const params = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });

    const query = params.toString();
    return query ? `?${query}` : '';
}

export function previousLabelRange(start, end) {
    if (!start || !end) return '';

    const startDate = parseISO(start);
    const endDate = parseISO(end);
    const span = Math.round((endDate - startDate) / 86400000) + 1;
    const previousEnd = subDays(startDate, 1);
    const previousStart = subDays(previousEnd, span - 1);

    return `${format(previousStart, 'yyyy-MM-dd')} / ${format(previousEnd, 'yyyy-MM-dd')}`;
}

export function nextPageQuery(searchParams, page) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    return `?${params.toString()}`;
}

export function normalizeDashboardFilters(filters) {
    return {
        start: filters?.start || daysAgoIso(29),
        end: filters?.end || todayIso(),
        client_id: filters?.client_id || '',
        paid: filters?.paid || ''
    };
}

export function normalizeInvoiceFilters(filters) {
    return {
        start: filters?.start || '',
        end: filters?.end || '',
        client_id: filters?.client_id || '',
        status: filters?.status || '',
        search: filters?.search || ''
    };
}

export function getExportUrl(filters) {
    return `/export${serializeParams(filters)}`;
}

export function getInvoicePdfUrl(publicId, download = false) {
    const safeId = encodeURIComponent(String(publicId || '').trim());
    const suffix = download ? '?download=1' : '';
    return `/api/invoices/${safeId}/pdf${suffix}`;
}

export function clampFutureDate(value) {
    if (!value) return todayIso();
    return value > todayIso() ? todayIso() : value;
}

export function tomorrowIso(value) {
    return format(addDays(parseISO(value), 1), 'yyyy-MM-dd');
}
