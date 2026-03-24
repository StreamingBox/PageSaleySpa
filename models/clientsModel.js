/* models/clientsModel.js */
const pool = require('../config/db');

module.exports = {
    findAll: () =>
        pool.execute('SELECT * FROM clients ORDER BY name'),

    findById: (id) =>
        pool.execute('SELECT * FROM clients WHERE id = ?', [id]),

    findBySearch: (term) =>
        pool.execute(
            `SELECT * FROM clients
             WHERE name LIKE ? OR phone LIKE ? OR address LIKE ? OR complemento LIKE ?
             ORDER BY name`,
            [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
        ),

    create: ({ name, phone, address, complemento }) =>
        pool.execute(
            'INSERT INTO clients (name, phone, address, complemento) VALUES (?, ?, ?, ?)',
            [name, phone || null, address || null, complemento || null]
        ),

    update: (id, { name, phone, address, complemento }) =>
        pool.execute(
            'UPDATE clients SET name = ?, phone = ?, address = ?, complemento = ? WHERE id = ?',
            [name, phone || null, address || null, complemento || null, id]
        ),

    delete: (id) =>
        pool.execute('DELETE FROM clients WHERE id = ?', [id]),

    fetchPendingDebts: (clientId) => {
        const clauses = ['s.active = 1', 's.paid = 0'];
        const params  = [];
        if (clientId) {
            clauses.push('s.client_id = ?');
            params.push(clientId);
        }
        return pool.execute(
            `SELECT
                c.id,
                c.name,
                c.phone,
                c.address,
                SUM(s.price) AS debt
             FROM sales s
             JOIN clients c ON c.id = s.client_id
             WHERE ${clauses.join(' AND ')}
             GROUP BY c.id, c.name, c.phone, c.address
             HAVING debt > 0
             ORDER BY debt DESC`,
            params
        );
    }
};
