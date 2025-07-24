/* models/movementsModel.js */
const pool = require('../config/db');

module.exports = {
    findAll: () =>
        pool.query('SELECT * FROM movements ORDER BY date DESC'),

    findById: (id) =>
        pool.query('SELECT * FROM movements WHERE id = ?', [id]),

    create: ({
                 date,
                 type,
                 amount,
                 payment_type,
                 category,
                 description,
                 account,
                 attachment
             }) =>
        pool.query(
            `INSERT INTO movements
       (date, type, amount, payment_type, category, description, account, attachment)
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
