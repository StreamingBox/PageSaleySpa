export function readQueryValues(search, keys) {
    const params = new URLSearchParams(search || '');

    return keys.reduce((values, key) => {
        values[key] = params.get(key) || '';
        return values;
    }, {});
}

export function compactValues(values) {
    return Object.fromEntries(
        Object.entries(values || {}).filter(([, value]) => String(value || '').trim())
    );
}

export function serializeInternalParams(values) {
    const params = new URLSearchParams();

    Object.entries(values || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, String(value));
        }
    });

    const query = params.toString();
    return query ? `?${query}` : '';
}

export function getRouteStateValues(location, key = 'filters') {
    return location.state?.[key] || {};
}

export function cleanVisibleSearch(location, navigate) {
    if (location.search) {
        navigate(location.pathname, {
            replace: true,
            state: location.state || null
        });
    }
}
