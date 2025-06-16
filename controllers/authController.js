/* controllers/authController.js */
const pool   = require('../config/db');
const bcrypt = require('bcrypt');

/* ---------- Helpers DB ---------- */
async function findUserByEmail(email) {
    const [[user]] = await pool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1', [email]
    );
    return user;
}
async function createUser(name, email, hash) {
    await pool.execute(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hash]
    );
}
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/* ---------- Formularios ---------- */
exports.showLogin    = (_req, res) => res.render('auth/login',    { error:null, email:'' });
exports.showRegister = (_req, res) => res.render('auth/register', { error:null });

/* ---------- Registro ---------- */
exports.register = async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return res.render('auth/register', { error:'Todos los campos son obligatorios.' });
    }
    try {
        if (await findUserByEmail(email)) {
            return res.render('auth/register', { error:'El correo ya está registrado.' });
        }
        const hash = await bcrypt.hash(password, 10);
        await createUser(name, email, hash);
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error:'Error al crear usuario.' });
    }
};

/* ---------- Login ---------- */
exports.login = async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.render('auth/login', { error:'Ingrese correo y contraseña.', email });
    }
    try {
        const user = await findUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.password))) {
            return res.render('auth/login', { error:'Credenciales inválidas.', email });
        }

        /* ===== Éxito → guardar usuario en sesión ===== */
        req.session.user = { id:user.id, name:user.name, email:user.email };

        const dest = req.session.returnTo || '/';
        delete req.session.returnTo;       // limpia la URL almacenada

        // asegura que la sesión se persista antes de redirigir
        req.session.save(() => res.redirect(dest));

    } catch (err) {
        console.error(err);
        res.render('auth/login', { error:'Error al iniciar sesión.', email });
    }
};

/* ---------- Logout ---------- */
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};
