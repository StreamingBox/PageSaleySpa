/* models/movementsModel.js */
const pool = require('../config/db');

function buildWhere({ startDate, endDate }) {
    const clauses = [];
    const params  = [];

    if (startDate) {
        clauses.push('date >= ?');
        params.push(startDate);
    }
    if (endDate) {
        clauses.push('date <= ?');
        params.push(endDate);
    }

    const whereSQL = clauses.length ? ('WHERE ' + clauses.join(' AND ')) : '';
    return { whereSQL, params };
}

module.exports = {
    // (sigue disponible si lo usas en otro lado)
    findAll: () =>
        pool.query('SELECT * FROM movements ORDER BY date DESC'),

    findById: (id) =>
        pool.query('SELECT * FROM movements WHERE id = ?', [id]),

    // ✅ NUEVO: listado con filtros y paginación
    findPaged: async ({ startDate, endDate, page = 1, pageSize = 20 }) => {
        const { whereSQL, params } = buildWhere({ startDate, endDate });
        const limit  = pageSize;
        const offset = (page - 1) * pageSize;

        // total para paginar
        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total FROM movements ${whereSQL}`,
            params
        );
        const total = countRows[0]?.total || 0;

        // datos de la página
        const [rows] = await pool.query(
            `SELECT * FROM movements ${whereSQL}
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return { rows, total };
    },

    create: ({
                 date, type, amount, payment_type, category, description, account, attachment
             }) =>
        pool.query(
            `INSERT INTO movements (date, type, amount, payment_type, category, description, account, attachment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [date, type, amount, payment_type, category, description, account, attachment]
        ),

    update: (id, data) =>
        pool.query(
            `UPDATE movements SET
         date = ?, type = ?, amount = ?, payment_type = ?,
         category = ?, description = ?, account = ?, attachment = ?
       WHERE id = ?`,
            [
                data.date, data.type, data.amount, data.payment_type,
                data.category, data.description, data.account, data.attachment,
                id
            ]
        ),

    delete: (id) =>
        pool.query('DELETE FROM movements WHERE id = ?', [id])
};
