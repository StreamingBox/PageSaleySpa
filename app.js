require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const methodOverride = require('method-override');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const MySQLStore = require('express-mysql-session')(session);
const { doubleCsrf } = require('csrf-csrf');

const apiRoutes = require('./routes/api');
const appRoutes = require('./routes/appRoutes');
const authRoutes = require('./routes/authRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

// --- Validacion de variables de entorno requeridas ---
function validateEnv() {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missing = required.filter(k => !process.env[k]);

    if (missing.length) {
        throw new Error(
            `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
            'Copia .env.example a .env y configura los valores.'
        );
    }

    if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET es requerido en produccion');
    }
}

validateEnv();

const isProduction = process.env.NODE_ENV === 'production';

// --- Seguridad: helmet con configuracion adaptada al SPA ---
app.use(helmet({
    contentSecurityPolicy: false
}));

// --- Compresion gzip/brotli ---
app.use(compression());

const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_REMEMBER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessionTtlMs = Number(process.env.SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS;
const rememberSessionTtlMs =
    Number(process.env.REMEMBER_SESSION_TTL_MS) || DEFAULT_REMEMBER_SESSION_TTL_MS;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// --- Sesiones con MySQL store (produccion) ---
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'cambialo_por_un_valor_seguro',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: sessionTtlMs,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction
    }
};

const dbOptions = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

try {
    const sessionStore = new MySQLStore(dbOptions);
    sessionStore.onReady().catch(() => {
        console.warn('MySQL session store no disponible, usando MemoryStore');
    });
    sessionStore.createDatabaseTable().catch(() => {});
    sessionConfig.store = sessionStore;
} catch (_err) {
    console.warn('Usando MemoryStore para sesiones (no apto para produccion)');
}

app.use(session(sessionConfig));

app.locals.sessionTtlMs = sessionTtlMs;
app.locals.rememberSessionTtlMs = rememberSessionTtlMs;

// --- CSRF protection ---
const {
    doubleCsrfProtection
} = doubleCsrf({
    getSecret: () => process.env.SESSION_SECRET || 'cambialo_por_un_valor_seguro',
    getSessionIdentifier: (req) => req.sessionID || req.ip || 'anon',
    getCsrfTokenFromRequest: (req) => {
        if (req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data')) {
            return typeof req.body?._csrf === 'string' ? req.body._csrf : '';
        }

        const headerToken = req.headers['x-csrf-token'];
        return typeof headerToken === 'string' ? headerToken : '';
    },
    skipCsrfProtection: (req) => !req.path.startsWith('/api/'),
    cookieName: 'x-csrf-token',
    cookieOptions: {
        httpOnly: false,
        sameSite: 'lax',
        secure: isProduction
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
});

app.use(doubleCsrfProtection);

app.use((req, res, next) => {
    const isSafeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (isSafeMethod && req.accepts('html')) {
        res.locals.csrfToken = req.csrfToken({ overwrite: true });
    }
    next();
});

// Error handler para CSRF
app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
        if (req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'Token CSRF invalido' });
        }
        return res.status(403).send('Token CSRF invalido. Recarga la pagina e intenta de nuevo.');
    }
    next(err);
});

app.use(methodOverride('_method'));

// --- Health check para CI/webServer readiness ---
app.get('/health', (_req, res) => res.status(200).send('ok'));

// --- Archivos estaticos con cache headers optimizados ---
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.includes('/app/') || filePath.includes('/brand/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// --- Uploads protegidos con autenticacion ---
const uploadsPath = path.join(__dirname, 'public', 'uploads');
app.use('/uploads', (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).send('No autorizado');
    }
    next();
}, express.static(uploadsPath));

// --- Rate limiting en login ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
    skipSuccessfulRequests: false
});

// --- Rutas ---
app.use('/login', (req, res, next) => {
    if (req.method === 'POST') {
        return loginLimiter(req, res, next);
    }

    return next();
});
app.use('/', authRoutes);
app.use('/', exportRoutes);
app.use('/api', apiRoutes);
app.use('/', appRoutes);

// --- Manejador de errores global ---
app.use((err, req, res, _next) => {
    if (err && err.code === 'EBADCSRFTOKEN') return;

    console.error(err);

    if (req.path.startsWith('/api/')) {
        res.status(err.status || 500).json({
            error: isProduction
                ? 'Error interno del servidor'
                : (err.message || 'Error interno del servidor'),
            ...(err.details && !isProduction ? { details: err.details } : {})
        });
        return;
    }

    res.status(500).send('Error interno del servidor');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server listening on http://localhost:${PORT}`);

    try {
        const { ensureIndexes } = require('./config/indexes');
        await ensureIndexes();
    } catch (_err) {}
});
