function getSessionUser(req) {
    return req.session?.user || null;
}

function isAdminSession(req) {
    return getSessionUser(req)?.role === 'admin';
}

function isUserSession(req) {
    return getSessionUser(req)?.role === 'user';
}

function hasRole(req, ...roles) {
    const role = getSessionUser(req)?.role;
    return Boolean(role && roles.includes(role));
}

function requireApiRoles(...roles) {
    return (req, res, next) => {
        if (!hasRole(req, ...roles)) {
            return res.status(403).json({
                error: 'No tienes permisos para realizar esta accion'
            });
        }

        return next();
    };
}

module.exports = {
    getSessionUser,
    hasRole,
    isAdminSession,
    isUserSession,
    requireApiRoles
};
