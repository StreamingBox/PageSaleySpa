const express = require('express');
const { isAuth } = require('../middleware/auth');

const router = express.Router();

function renderShell(req, res) {
    res.render('app-shell', {
        initialState: {
            user: req.session.user,
            path: req.path
        }
    });
}

[
    '/',
    '/clients',
    '/clients/new',
    '/clients/:hash',
    '/clients/:hash/edit',
    '/appointments',
    '/products',
    '/products/new',
    '/products/:hash/edit',
    '/invoices',
    '/invoices/new',
    '/invoices/:publicId',
    '/sales',
    '/sales/new',
    '/sales/:id/edit',
    '/movements',
    '/movements/new',
    '/movements/:id/edit',
    '/categories',
    '/categories/new',
    '/categories/:id/edit'
].forEach(routePath => {
    router.get(routePath, isAuth, renderShell);
});

module.exports = router;
