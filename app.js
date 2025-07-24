require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override'); // 👈 Agregado

const app = express();

/* --- rutas --- */
const authRoutes       = require('./routes/authRoutes');
const homeRoutes       = require('./routes/homeRoutes');
const clientsRoutes    = require('./routes/clientsRoutes');
const productsRoutes   = require('./routes/productsRoutes');
const salesRoutes      = require('./routes/salesRoutes');
const movementsRoutes  = require('./routes/movementsRoutes');
const reportsRoutes    = require('./routes/reports');
const categoriesRoutes = require('./routes/categories');

/* --- EJS --- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* --- Middlewares de parsing --- */
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* ✅ Middleware para permitir PUT y DELETE desde formularios */
app.use(methodOverride('_method')); // 👈 Importante para DELETE y PUT

/* ✅ Middleware para pasar la ruta actual a las vistas (navbar activo) */
app.use((req, res, next) => {
    res.locals.path = req.path;
    next();
});

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
app.use('/',           authRoutes);
app.use('/',           homeRoutes);
app.use('/clients',    clientsRoutes);
app.use('/products',   productsRoutes);
app.use('/sales',      salesRoutes);
app.use('/movements',  movementsRoutes);
app.use('/categories', categoriesRoutes);
app.use('/reports',    reportsRoutes);

/* --- Manejador de errores --- */
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Error interno del servidor');
});

/* --- Arranque del servidor --- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
