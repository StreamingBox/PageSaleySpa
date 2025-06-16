// app.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

/* --- rutas --- */
const authRoutes     = require('./routes/authRoutes');
const homeRoutes     = require('./routes/homeRoutes');
const clientsRoutes  = require('./routes/clientsRoutes');
const productsRoutes = require('./routes/productsRoutes');
const salesRoutes    = require('./routes/salesRoutes');

const app = express();

/* --- EJS --- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* --- Middlewares --- */
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

/* Sesión: 5 min · rolling para reiniciar con cada request */
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'change_this_to_a_secure_value',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { maxAge: 5 * 60 * 1000 }          // 5 minutos
    })
);

/* --- Rutas --- */
app.use('/',          authRoutes);     // /login, /register…
app.use('/',          homeRoutes);     // /  -> dashboard
app.use('/clients',   clientsRoutes);
app.use('/products',  productsRoutes);
app.use('/sales',     salesRoutes);

/* --- Listen --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
