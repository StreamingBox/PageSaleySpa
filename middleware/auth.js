// middleware/auth.js
function isAuth (req, res, next) {
    // 1 · ¿hay sesión y usuario logueado?
    if (req.session && req.session.user) return next();

    // 2 · si no, guarda a dónde quería ir y manda a login
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
}

module.exports = { isAuth };
