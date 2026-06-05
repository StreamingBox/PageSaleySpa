function getCsrfTokenFromRequest(req) {
    const headerToken = req.headers?.['x-csrf-token'];

    if (Array.isArray(headerToken)) {
        return headerToken.find(Boolean) || '';
    }

    if (typeof headerToken === 'string' && headerToken.trim()) {
        return headerToken;
    }

    const bodyToken = req.body?._csrf;
    return typeof bodyToken === 'string' ? bodyToken : '';
}

module.exports = {
    getCsrfTokenFromRequest
};
