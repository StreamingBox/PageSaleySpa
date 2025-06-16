/* controllers/authController.js */
const pool    = require('../config/db');
const bcrypt  = require('bcrypt');

/* ------------- Helpers DB ------------- */
async function findUserByEmail(email) {
    const [[user]] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return user;
}
async function createUser(name, email, hash) {
    await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
}
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/* ------------- Mostrar formularios ------------- */
exports.showLogin = (_req, res)  => res.render('auth/login',    { error: null });
exports.showRegister = (_req, res) => res.render('auth/register', { error: null });

/* ------------- Registro ------------- */
exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.render('auth/register', { error: 'Todos los campos son obligatorios.' });
    }
    try {
        const userExists = await findUserByEmail(email);
        if (userExists) {
            return res.render('auth/register', { error: 'El correo ya está registrado.' });
        }
        const hash = await bcrypt.hash(password, 10);
        await createUser(name, email, hash);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Error al crear usuario.' });
    }
};

/* ------------- Login ------------- */
exports.login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render('auth/login', { error: 'Ingrese correo y contraseña.' });
    }
    try {
        const user = await findUserByEmail(email);
        if (!user) {
            return res.render('auth/login', { error: 'Credenciales inválidas.' });
        }
        const ok = await verifyPassword(password, user.password);
        if (!ok) {
            return res.render('auth/login', { error: 'Credenciales inválidas.' });
        }

        /* Session init (5-min timeout ya configurado en app.js) */
        req.session.userId = user.id;
        req.session.userName = user.name;
        return res.redirect('/');          // dashboard
    } catch (err) {
        console.error(err);
        res.render('auth/login', { error: 'Error al iniciar sesión.' });
    }
};

/* ------------- Logout ------------- */
exports.logout = (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
};
