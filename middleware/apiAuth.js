const { requireApiRoles } = require('./authorization');

function isApiAuth(req, res, next) {
    if (req.session && req.session.user) return next();

    return res.status(401).json({
        error: 'No autorizado'
    });
}

module.exports = {
    isApiAuth,
    requireApiRoles
};
