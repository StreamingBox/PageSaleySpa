require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override');

const apiRoutes = require('./routes/api');
const appRoutes = require('./routes/appRoutes');
const authRoutes = require('./routes/authRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const sessionTtlMs = Number(process.env.SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'cambialo_por_un_valor_seguro',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            maxAge: sessionTtlMs,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        }
    })
);

app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use('/', authRoutes);
app.use('/', exportRoutes);
app.use('/api', apiRoutes);
app.use('/', appRoutes);

app.use((err, req, res, next) => {
    console.error(err);

    if (req.path.startsWith('/api/')) {
        res.status(err.status || 500).json({
            error: err.message || 'Error interno del servidor',
            ...(err.details ? { details: err.details } : {})
        });
        return;
    }

    res.status(500).send('Error interno del servidor');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
