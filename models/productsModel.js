/* models/productsModel.js */
const pool = require('../config/db');

module.exports = {
    findAll: () =>
        pool.execute('SELECT * FROM products ORDER BY name'),

    findById: (id) =>
        pool.execute('SELECT * FROM products WHERE id = ?', [id]),

    findBySearch: (term) =>
        pool.execute(
            'SELECT * FROM products WHERE name LIKE ? ORDER BY name',
            [`%${term}%`]
        ),

    create: ({ name, price }) =>
        pool.execute(
            'INSERT INTO products (name, price) VALUES (?, ?)',
            [name, price]
        ),

    update: (id, { name, price }) =>
        pool.execute(
            'UPDATE products SET name = ?, price = ? WHERE id = ?',
            [name, price, id]
        ),

    delete: (id) =>
        pool.execute('DELETE FROM products WHERE id = ?', [id]),

    findTopSelling: (startDate, endDate, limit = 10) =>
        pool.execute(
            `SELECT
                p.id,
                p.name AS product_name,
                COUNT(*) AS sales_count,
                COALESCE(SUM(s.quantity), 0) AS units,
                COALESCE(SUM(s.price), 0) AS total
             FROM sales s
             JOIN products p ON p.id = s.product_id
             WHERE s.active = 1
               AND s.sold_at >= ?
               AND s.sold_at < ?
             GROUP BY p.id, p.name
             ORDER BY total DESC, units DESC, sales_count DESC, p.name ASC
             LIMIT ?`,
            [startDate, endDate, limit]
        )
};
