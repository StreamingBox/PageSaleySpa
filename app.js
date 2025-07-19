require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

/* --- rutas --- */
const authRoutes      = require('./routes/authRoutes');
const homeRoutes      = require('./routes/homeRoutes');
const clientsRoutes   = require('./routes/clientsRoutes');
const productsRoutes  = require('./routes/productsRoutes');
const salesRoutes     = require('./routes/salesRoutes');
const movementsRoutes = require('./routes/movementsRoutes');

const app = express();

/* --- EJS --- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* --- Middlewares de parsing --- */
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* --- Sesión: 5 min · rolling --- */
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'cámbialo_por_un_valor_seguro',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: { maxAge: 5 * 60 * 1000 }
    })
);

/* --- Archivos estáticos y uploads --- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

/* --- Rutas de la App --- */
// IMPORTANTE: monta primero todas las rutas que usan session
app.use('/',         authRoutes);
app.use('/',         homeRoutes);
app.use('/clients',  clientsRoutes);
app.use('/products', productsRoutes);
app.use('/sales',    salesRoutes);
app.use('/movements', movementsRoutes);

/* --- Manejador de errores básico --- */
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Error interno del servidor');
});

/* --- Arranque del servidor --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
