const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

function toIsoDate(dateValue) {
    const value = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return value.toISOString().slice(0, 10);
}

function mapMovement(row) {
    return {
        id: row.id,
        date: toIsoDate(row.date),
        type: row.type,
        amount: Number(row.amount),
        payment_type: row.payment_type,
        category: row.category,
        description: row.description || '',
        account: row.account || '',
        attachment: row.attachment || '',
        attachment_url: row.attachment ? `/uploads/${encodeURIComponent(row.attachment)}` : ''
    };
}

function resolveOrderBy(sort) {
    switch (sort) {
        case 'date-asc':
            return 'date ASC, id ASC';
        case 'amount-desc':
            return 'amount DESC, date DESC, id DESC';
        case 'amount-asc':
            return 'amount ASC, date ASC, id ASC';
        case 'category-asc':
            return 'category ASC, date DESC, id DESC';
        case 'category-desc':
            return 'category DESC, date DESC, id DESC';
        case 'date-desc':
        default:
            return 'date DESC, id DESC';
    }
}

async function listMovements({ start, end, page = 1, pageSize = 20, sort = 'date-desc' } = {}) {
    const clauses = [];
    const params = [];

    if (start) {
        clauses.push('date >= ?');
        params.push(start);
    }

    if (end) {
        clauses.push('date <= ?');
        params.push(end);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM movements ${whereSql}`,
        params
    );
    const total = Number(countRows[0]?.total || 0);
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize =
        String(pageSize) === 'all'
            ? Math.max(total, 1)
            : Math.max(1, Number(pageSize) || 20);
    const offset = (safePage - 1) * safePageSize;
    const orderBy = resolveOrderBy(sort);

    const [rows] = await pool.execute(
        `SELECT * FROM movements
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, safePageSize, offset]
    );

    return {
        rows: rows.map(mapMovement),
        meta: {
            page: safePage,
            pageSize: safePageSize,
            sort,
            total,
            totalPages: Math.max(1, Math.ceil(total / safePageSize))
        }
    };
}

async function getMovementById(id) {
    const [rows] = await pool.execute('SELECT * FROM movements WHERE id = ?', [id]);
    return rows.length ? mapMovement(rows[0]) : null;
}

async function createMovement(payload) {
    const [result] = await pool.execute(
        `INSERT INTO movements
            (date, type, amount, payment_type, category, description, account, attachment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.date,
            payload.type,
            payload.amount,
            payload.payment_type,
            payload.category,
            payload.description || null,
            payload.account || null,
            payload.attachment || null
        ]
    );

    return getMovementById(result.insertId);
}

function removeAttachment(filename) {
    if (!filename) return;

    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

async function updateMovement(id, payload) {
    const current = await getMovementById(id);
    if (!current) return null;

    const attachment = payload.attachment || payload.currentAttachment || '';
    if (payload.attachment && current.attachment && current.attachment !== payload.attachment) {
        removeAttachment(current.attachment);
    }

    await pool.execute(
        `UPDATE movements
            SET date = ?,
                type = ?,
                amount = ?,
                payment_type = ?,
                category = ?,
                description = ?,
                account = ?,
                attachment = ?
          WHERE id = ?`,
        [
            payload.date,
            payload.type,
            payload.amount,
            payload.payment_type,
            payload.category,
            payload.description || null,
            payload.account || null,
            attachment || null,
            id
        ]
    );

    return getMovementById(id);
}

async function deleteMovement(id) {
    const movement = await getMovementById(id);
    if (!movement) return;

    removeAttachment(movement.attachment);
    await pool.execute('DELETE FROM movements WHERE id = ?', [id]);
}

async function getMovementTotalsByRange(start, end) {
    const [rows] = await pool.execute(
        `SELECT type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
         FROM movements
         WHERE date BETWEEN ? AND ?
         GROUP BY type`,
        [start, end]
    );

    const base = {
        ingreso: { count: 0, total: 0 },
        gasto: { count: 0, total: 0 }
    };

    for (const row of rows) {
        if (row.type === 'ingreso') {
            base.ingreso = {
                count: Number(row.count),
                total: Number(row.total)
            };
        }

        if (row.type === 'gasto') {
            base.gasto = {
                count: Number(row.count),
                total: Number(row.total)
            };
        }
    }

    return base;
}

module.exports = {
    createMovement,
    deleteMovement,
    getMovementById,
    getMovementTotalsByRange,
    listMovements,
    updateMovement
};
