const {
    addDays,
    differenceInCalendarDays,
    format,
    isValid,
    parseISO,
    subDays
} = require('date-fns');

function parseIsoDate(value) {
    if (!value) return null;

    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
}

function toIsoDate(value) {
    return format(value, 'yyyy-MM-dd');
}

function normalizeRange(startDate, endDate) {
    if (startDate <= endDate) {
        return { startDate, endDate };
    }

    return {
        startDate: endDate,
        endDate: startDate
    };
}

function resolveDashboardRange(start, end) {
    const endDate = parseIsoDate(end) || new Date();
    const startDate = parseIsoDate(start) || subDays(endDate, 29);

    return normalizeRange(startDate, endDate);
}

function getPreviousEqualRange(startDate, endDate) {
    const span = differenceInCalendarDays(endDate, startDate) + 1;
    const previousEndDate = subDays(startDate, 1);
    const previousStartDate = subDays(previousEndDate, span - 1);

    return {
        startDate: previousStartDate,
        endDate: previousEndDate
    };
}

function toExclusiveEnd(endDate) {
    return addDays(endDate, 1);
}

module.exports = {
    getPreviousEqualRange,
    parseIsoDate,
    resolveDashboardRange,
    toExclusiveEnd,
    toIsoDate
};
