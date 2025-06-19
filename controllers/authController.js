const pool   = require('../config/db');
const bcrypt = require('bcrypt');

/* ---------- Helpers DB ---------- */
async function findUserByEmail(email) {
    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
    );
    return user;
}

async function createUser(username, email, hash) {
    await pool.execute(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hash]
    );
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/* ---------- Formularios ---------- */
exports.showLogin = (_req, res) =>
    res.render('auth/login', { error: null, email: '' });

exports.showRegister = (_req, res) =>
    res.render('auth/register', {
        error: null,
        username: '',
        email: ''
    });

/* ---------- Registro ---------- */
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
                error: 'El correo ya está registrado.',
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

/* ---------- Login ---------- */
exports.login = async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.render('auth/login', {
            error: 'Ingrese correo y contraseña.',
            email
        });
    }

    try {
        const user = await findUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.password))) {
            return res.render('auth/login', {
                error: 'Credenciales inválidas.',
                email
            });
        }

        // Éxito → guardar usuario en sesión
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        const dest = req.session.returnTo || '/';
        delete req.session.returnTo;
        req.session.save(() => res.redirect(dest));
    } catch (err) {
        console.error(err);
        res.render('auth/login', {
            error: 'Error al iniciar sesión.',
            email
        });
    }
};

/* ---------- Logout ---------- */
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
