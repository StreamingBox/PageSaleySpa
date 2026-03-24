export const TOP_LIMIT_OPTIONS = [
    { value: '5', label: 'Top 5' },
    { value: '10', label: 'Top 10' },
    { value: '20', label: 'Top 20' },
    { value: '30', label: 'Top 30' },
    { value: 'all', label: 'Todos' }
];

export function compareText(left, right) {
    return String(left || '').localeCompare(String(right || ''), 'es', {
        sensitivity: 'base'
    });
}

export function compareNumber(left, right) {
    return Number(left || 0) - Number(right || 0);
}

export function compareDate(left, right) {
    return new Date(left).getTime() - new Date(right).getTime();
}

export function applyVisibleLimit(rows, limit) {
    if (limit === 'all') {
        return rows;
    }

    return rows.slice(0, Number(limit));
}
