const { hasRole } = require('./authorization');

function isAuth(req, res, next) {
    if (req.session && req.session.user) return next();

    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
}

function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.session?.user) {
            req.session.returnTo = req.originalUrl;
            return res.redirect('/login');
        }

        if (!hasRole(req, ...roles)) {
            return res.redirect(req.session.user.role === 'admin' ? '/' : '/appointments');
        }

        return next();
    };
}

module.exports = { isAuth, requireRoles };
