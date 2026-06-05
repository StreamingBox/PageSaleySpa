const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { createClient } = require('../services/clientsService');

async function ensureUsersSchema() {
    const [roleColumns] = await pool.query(`SHOW COLUMNS FROM users LIKE 'role'`);
    if (!roleColumns.length) {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin' AFTER password
        `);
    }

    const [clientColumns] = await pool.query(`SHOW COLUMNS FROM users LIKE 'client_id'`);
    if (!clientColumns.length) {
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN client_id INT NULL AFTER role
        `);
    }
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function findUserByEmail(email) {
    await ensureUsersSchema();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return null;
    }

    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [normalizedEmail]
    );
    return user;
}

async function createClientForUser(username) {
    const client = await createClient({
        name: username,
        phone: '',
        address: '',
        complemento: ''
    });

    return client.id;
}

async function createUser(username, email, hash) {
    await ensureUsersSchema();

    const clientId = await createClientForUser(username);
    const [[stats]] = await pool.execute('SELECT COUNT(*) AS total FROM users');
    const role = Number(stats?.total || 0) === 0 ? 'admin' : 'user';

    await pool.execute(
        'INSERT INTO users (username, email, password, role, client_id) VALUES (?, ?, ?, ?, ?)',
        [username, email, hash, role, clientId]
    );
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function buildSessionUser(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'admin',
        client_id: user.client_id ? Number(user.client_id) : null
    };
}

function setNoStore(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
}

function renderLogin(req, res, payload = {}) {
    setNoStore(res);
    return res.render('auth/login', {
        csrfToken: req.csrfToken({ overwrite: true }),
        error: null,
        email: '',
        rememberSession: false,
        ...payload
    });
}

function renderRegister(req, res, payload = {}) {
    setNoStore(res);
    return res.render('auth/register', {
        csrfToken: req.csrfToken({ overwrite: true }),
        error: null,
        username: '',
        email: '',
        ...payload
    });
}

exports.showLogin = (req, res) => renderLogin(req, res);

exports.showRegister = (req, res) => renderRegister(req, res);

exports.register = async (req, res) => {
    const { username, email, password } = req.body || {};
    const normalizedUsername = String(username || '').trim();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedUsername || !normalizedEmail || !password) {
        return renderRegister(req, res, {
            error: 'Todos los campos son obligatorios.',
            username: normalizedUsername,
            email: normalizedEmail
        });
    }

    if (password.length < 8) {
        return renderRegister(req, res, {
            error: 'La contrasena debe tener al menos 8 caracteres.',
            username: normalizedUsername,
            email: normalizedEmail
        });
    }

    try {
        if (await findUserByEmail(normalizedEmail)) {
            return renderRegister(req, res, {
                error: 'El correo ya esta registrado.',
                username: normalizedUsername,
                email: normalizedEmail
            });
        }

        const hash = await bcrypt.hash(password, 12);
        await createUser(normalizedUsername, normalizedEmail, hash);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        return renderRegister(req, res, {
            error: 'Error al crear usuario.',
            username: normalizedUsername,
            email: normalizedEmail
        });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const rememberSession =
        req.body?.remember_session === '1' || req.body?.remember_session === 'on';

    if (!normalizedEmail || !password) {
        return renderLogin(req, res, {
            error: 'Ingrese correo y contrasena.',
            email: normalizedEmail,
            rememberSession
        });
    }

    try {
        const user = await findUserByEmail(normalizedEmail);
        if (!user || !(await verifyPassword(password, user.password))) {
            return renderLogin(req, res, {
                error: 'Credenciales invalidas.',
                email: normalizedEmail,
                rememberSession
            });
        }

        const fallbackPath = user.role === 'admin' ? '/' : '/appointments';
        const dest = req.session.returnTo || fallbackPath;
        delete req.session.returnTo;

        req.session.regenerate((err) => {
            if (err) {
                console.error(err);
                return renderLogin(req, res, {
                    error: 'Error al iniciar sesion.',
                    email: normalizedEmail,
                    rememberSession
                });
            }

            req.session.user = buildSessionUser(user);
            req.session.rememberSession = rememberSession;
            req.session.cookie.maxAge = rememberSession
                ? res.app.locals.rememberSessionTtlMs
                : res.app.locals.sessionTtlMs;

            req.session.save(() => res.redirect(dest));
        });
    } catch (err) {
        console.error(err);
        return renderLogin(req, res, {
            error: 'Error al iniciar sesion.',
            email: normalizedEmail,
            rememberSession
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
