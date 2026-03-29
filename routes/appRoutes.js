const express = require('express');
const { isAuth } = require('../middleware/auth');
const { isAdminSession } = require('../middleware/authorization');

const router = express.Router();

function renderShell(req, res) {
    res.render('app-shell', {
        initialState: {
            user: req.session.user,
            path: req.path
        }
    });
}

router.get('/', isAuth, (req, res, next) => {
    if (!isAdminSession(req)) {
        return res.redirect('/appointments');
    }

    return next();
}, renderShell);

['/appointments', '/profile', '/profile/edit'].forEach(routePath => {
    router.get(routePath, isAuth, renderShell);
});

[
    '/clients',
    '/clients/new',
    '/clients/:hash',
    '/clients/:hash/edit',
    '/products',
    '/products/new',
    '/products/:hash/edit',
    '/invoices',
    '/invoices/new',
    '/invoices/:publicId',
    '/sales',
    '/sales/new',
    '/sales/:id/edit',
    '/analytics',
    '/movements',
    '/movements/new',
    '/movements/:id/edit',
    '/categories',
    '/categories/new',
    '/categories/:id/edit'
].forEach(routePath => {
    router.get(routePath, isAuth, (req, res, next) => {
        if (!isAdminSession(req)) {
            return res.redirect('/appointments');
        }

        return next();
    }, renderShell);
});

module.exports = router;
