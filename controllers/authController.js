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

async function findUserByEmail(email) {
    await ensureUsersSchema();

    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
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

exports.showLogin = (_req, res) =>
    res.render('auth/login', { error: null, email: '' });

exports.showRegister = (_req, res) =>
    res.render('auth/register', {
        error: null,
        username: '',
        email: ''
    });

exports.register = async (req, res) => {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
        return res.render('auth/register', {
            error: 'Todos los campos son obligatorios.',
            username: username || '',
            email: email || ''
        });
    }

    try {
        if (await findUserByEmail(email)) {
            return res.render('auth/register', {
                error: 'El correo ya esta registrado.',
                username,
                email
            });
        }

        const hash = await bcrypt.hash(password, 10);
        await createUser(username, email, hash);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('auth/register', {
            error: 'Error al crear usuario.',
            username,
            email
        });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.render('auth/login', {
            error: 'Ingrese correo y contrasena.',
            email
        });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.password))) {
            return res.render('auth/login', {
                error: 'Credenciales invalidas.',
                email
            });
        }

        req.session.user = buildSessionUser(user);

        const fallbackPath = req.session.user.role === 'admin' ? '/' : '/appointments';
        const dest = req.session.returnTo || fallbackPath;
        delete req.session.returnTo;
        req.session.save(() => res.redirect(dest));
    } catch (err) {
        console.error(err);
        res.render('auth/login', {
            error: 'Error al iniciar sesion.',
            email
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
