/* models/usersModel.js */
const pool = require('../config/db');

module.exports = {
    findAll: () =>
        pool.execute('SELECT id, username, email, created_at FROM users ORDER BY username'),

    findById: (id) =>
        pool.execute(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [id]
        ),

    findByEmail: (email) =>
        pool.execute(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [email]
        ),

    findByUsername: (username) =>
        pool.execute(
            'SELECT * FROM users WHERE username = ? LIMIT 1',
            [username]
        ),

    create: ({ username, email, password_hash }) =>
        pool.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, password_hash]
        ),

    updatePassword: (id, password_hash) =>
        pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [password_hash, id]
        ),

    delete: (id) =>
        pool.execute('DELETE FROM users WHERE id = ?', [id])
};
