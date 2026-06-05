require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { randomUUID } = require('crypto');
const methodOverride = require('method-override');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const MySQLStore = require('express-mysql-session')(session);
const { doubleCsrf } = require('csrf-csrf');
const { getEnvWarnings, validateEnv } = require('./config/env');
const { getCsrfTokenFromRequest } = require('./utils/csrfToken');

// --- Validacion de variables de entorno requeridas ---
const isProduction = process.env.NODE_ENV === 'production';
validateEnv();
getEnvWarnings().forEach(message => console.warn(message));

const apiRoutes = require('./routes/api');
const appRoutes = require('./routes/appRoutes');
const authRoutes = require('./routes/authRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

if (isProduction) {
    app.set('trust proxy', 1);
}

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
    sessionStore.onReady().catch((err) => {
        const message = `MySQL session store no disponible: ${err.message}`;
        if (isProduction) {
            console.error(message);
            process.exit(1);
        }

        console.warn(message);
    });
    sessionStore.createDatabaseTable().catch(() => {});
    sessionConfig.store = sessionStore;
} catch (err) {
    if (isProduction) {
        throw err;
    }

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
    getSessionIdentifier: (req) => req.session?.csrfSeed || req.sessionID || req.ip || 'anon',
    getCsrfTokenFromRequest,
    skipCsrfProtection: (req) => ['/login', '/register', '/logout'].includes(req.path),
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

function ensureCsrfSessionSeed(req) {
    if (req.session && !req.session.csrfSeed) {
        req.session.csrfSeed = randomUUID();
    }
}

app.use((req, res, next) => {
    const isSafeMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (isSafeMethod && req.accepts('html')) {
        ensureCsrfSessionSeed(req);
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

// --- Archivos estaticos con cache conservadora ---
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}app${path.sep}`)) {
            // Los bundles tienen nombres estables, asi que no deben servirse como immutable.
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return;
        }

        if (filePath.includes(`${path.sep}brand${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
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

// --- Rate limiting en autenticacion ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
    skipSuccessfulRequests: false
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados registros. Intenta de nuevo en 1 hora.',
    skipSuccessfulRequests: false
});

// --- Rutas ---
app.use('/login', (req, res, next) => {
    if (req.method === 'POST') {
        return loginLimiter(req, res, next);
    }

    return next();
});
app.use('/register', (req, res, next) => {
    if (req.method === 'POST') {
        return registerLimiter(req, res, next);
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
