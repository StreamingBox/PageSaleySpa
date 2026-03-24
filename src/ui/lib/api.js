export async function apiFetch(url, options = {}) {
    const { body, headers, method = 'GET' } = options;
    const isFormData = body instanceof FormData;

    const response = await fetch(url, {
        credentials: 'same-origin',
        method,
        headers: {
            ...(isFormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
            ...(headers || {})
        },
        body: isFormData ? body : body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Tu sesión expiró');
    }

    if (response.status === 204) {
        return null;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || 'Ocurrió un error inesperado');
    }

    return payload;
}
