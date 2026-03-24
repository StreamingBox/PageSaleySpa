// routes/authRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../controllers/authController');

function redirectIfAuthenticated(req, res, next) {
    if (req.session?.user) {
        return res.redirect('/');
    }

    return next();
}

// Formulario de login
router.get('/login',  redirectIfAuthenticated, auth.showLogin);
router.post('/login', auth.login);

// Registro (si lo usas)
router.get('/register',  redirectIfAuthenticated, auth.showRegister);
router.post('/register', auth.register);

// Logout — destruye la sesión y vuelve al login
router.get('/logout', auth.logout);

module.exports = router;
