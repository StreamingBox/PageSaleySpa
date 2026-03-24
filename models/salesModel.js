/* models/salesModel.js */
const pool = require('../config/db');

function buildSaleWhere(filters) {
    const clauses = ['s.active = 1'];
    const params  = [];

    if (filters.start) {
        clauses.push('s.sold_at >= ?');
        params.push(filters.start);
    }
    if (filters.end) {
        clauses.push('s.sold_at < ?');
        params.push(filters.end);
    }
    if (filters.clientId) {
        clauses.push('s.client_id = ?');
        params.push(filters.clientId);
    }
    if (filters.paid === '0' || filters.paid === '1' || filters.paid === 0 || filters.paid === 1) {
        clauses.push('s.paid = ?');
        params.push(Number(filters.paid));
    }

    return { clauses, params };
}

const BASE_SELECT = `
    SELECT
        s.*,
        c.name AS client_name,
        p.name AS product_name,
        i.id AS invoice_id,
        i.public_id AS invoice_public_id,
        i.invoice_number,
        i.status AS invoice_status
     FROM sales s
     JOIN clients c ON c.id = s.client_id
     JOIN products p ON p.id = s.product_id
     LEFT JOIN invoice_items ii ON ii.sale_id = s.id
     LEFT JOIN invoices i ON i.id = ii.invoice_id
`;

module.exports = {
    findAll: (filters = {}) => {
        const { clauses, params } = buildSaleWhere(filters);
        return pool.execute(
            `${BASE_SELECT}
             WHERE ${clauses.join(' AND ')}
             ORDER BY s.sold_at DESC, s.id DESC`,
            params
        );
    },

    findById: (id) =>
        pool.execute(
            `${BASE_SELECT}
             WHERE s.id = ? AND s.active = 1
             LIMIT 1`,
            [id]
        ),

    create: ({ client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source }) =>
        pool.execute(
            `INSERT INTO sales
                (client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source]
        ),

    update: (id, { client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source }) =>
        pool.execute(
            `UPDATE sales
                SET client_id = ?,
                    product_id = ?,
                    quantity = ?,
                    unit_price = ?,
                    price = ?,
                    sold_at = ?,
                    paid = ?,
                    payment_source = ?
              WHERE id = ? AND active = 1`,
            [client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source, id]
        ),

    deactivate: (id) =>
        pool.execute('UPDATE sales SET active = 0 WHERE id = ?', [id]),

    getStats: (startIso, endExclusiveIso, extraClauses = [], extraParams = []) =>
        pool.execute(
            `SELECT
                COUNT(*) AS sales_count,
                COALESCE(SUM(price), 0) AS total_revenue,
                COALESCE(SUM(quantity), 0) AS total_quantity
             FROM sales
             WHERE active = 1
               AND sold_at >= ?
               AND sold_at < ?
               ${extraClauses.length ? 'AND ' + extraClauses.join(' AND ') : ''}`,
            [startIso, endExclusiveIso, ...extraParams]
        ),

    getDailySeries: (startIso, endExclusiveIso) =>
        pool.execute(
            `SELECT
                sold_at,
                COUNT(*) AS sales_count,
                COALESCE(SUM(quantity), 0) AS units,
                COALESCE(SUM(price), 0) AS total
             FROM sales
             WHERE active = 1
               AND sold_at >= ?
               AND sold_at < ?
             GROUP BY sold_at
             ORDER BY sold_at ASC`,
            [startIso, endExclusiveIso]
        )
};
