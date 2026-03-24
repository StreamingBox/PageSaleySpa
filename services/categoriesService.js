const pool = require('../config/db');

function mapCategory(row) {
    return {
        id: row.id,
        name: row.name
    };
}

async function listCategories({ search = '' } = {}) {
    const term = search.trim();
    const params = [];
    let sql = 'SELECT * FROM categories';

    if (term) {
        sql += ' WHERE name LIKE ?';
        params.push(`%${term}%`);
    }

    sql += ' ORDER BY name';

    const [rows] = await pool.execute(sql, params);
    return rows.map(mapCategory);
}

async function getCategoryById(id) {
    const [rows] = await pool.execute('SELECT * FROM categories WHERE id = ?', [
        id
    ]);

    return rows.length ? mapCategory(rows[0]) : null;
}

async function createCategory({ name }) {
    const [result] = await pool.execute(
        'INSERT INTO categories (name) VALUES (?)',
        [name]
    );

    return getCategoryById(result.insertId);
}

async function updateCategory(id, { name }) {
    await pool.execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
    return getCategoryById(id);
}

async function deleteCategory(id) {
    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
}

module.exports = {
    createCategory,
    deleteCategory,
    getCategoryById,
    listCategories,
    updateCategory
};
