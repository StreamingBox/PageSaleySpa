/* models/categoriesModel.js */
const pool = require('../config/db');

module.exports = {
    findAll:   ()           => pool.query('SELECT * FROM categories ORDER BY name'),
    findById:  (id)         => pool.query('SELECT * FROM categories WHERE id = ?', [id]),
    create:    ({ name })   => pool.query('INSERT INTO categories (name) VALUES (?)', [name]),
    update:    (id, {name}) => pool.query('UPDATE categories SET name = ? WHERE id = ?', [name, id]),
    delete:    (id)         => pool.query('DELETE FROM categories WHERE id = ?', [id])
};
