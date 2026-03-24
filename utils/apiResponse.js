function sendData(res, data, meta) {
    if (meta) {
        return res.json({ data, meta });
    }

    return res.json({ data });
}

function sendError(res, status, message, details) {
    return res.status(status).json({
        error: message,
        ...(details ? { details } : {})
    });
}

module.exports = {
    sendData,
    sendError
};
