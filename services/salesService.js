const pool = require('../config/db');
const { toExclusiveEnd, toIsoDate } = require('../utils/dateRange');
const { formatProperCase } = require('../utils/properCase');
const { ensureInvoiceSchema } = require('./invoicesSchemaService');
const { assertSaleCanMutate } = require('./invoicesService');

function mapSale(row) {
    return {
        id: row.id,
        client_id: row.client_id,
        client_name: formatProperCase(row.client_name),
        product_id: row.product_id,
        product_name: formatProperCase(row.product_name),
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        price: Number(row.price),
        sold_at: toIsoDate(new Date(row.sold_at)),
        paid: Number(row.paid),
        payment_source: row.payment_source || 'PENDIENTE',
        active: Number(row.active),
        invoice_id: row.invoice_id ? Number(row.invoice_id) : null,
        invoice_public_id: row.invoice_public_id || '',
        invoice_number: row.invoice_number || '',
        invoice_status: row.invoice_status || ''
    };
}

function normalizeSalePayload(payload) {
    const quantity = parseInt(payload.quantity, 10);
    const unitPrice = Number(payload.unit_price);
    const providedPrice = Number(payload.price);
    const paid = payload.paid === 1 || payload.paid === '1' ? 1 : 0;
    const price =
        Number.isFinite(providedPrice) && providedPrice > 0
            ? providedPrice
            : quantity * unitPrice;

    return {
        client_id: Number(payload.client_id),
        product_id: Number(payload.product_id),
        quantity,
        unit_price: unitPrice,
        price,
        sold_at: payload.sold_at,
        paid,
        payment_source: paid ? payload.payment_source || 'EFECTIVO' : 'PENDIENTE'
    };
}

async function listSales({ start, end, clientId, paid }) {
    await ensureInvoiceSchema();

    const clauses = ['s.active = 1'];
    const params = [];

    if (start) {
        clauses.push('s.sold_at >= ?');
        params.push(start);
    }

    if (end) {
        clauses.push('s.sold_at < ?');
        params.push(toIsoDate(toExclusiveEnd(new Date(end))));
    }

    if (clientId) {
        clauses.push('s.client_id = ?');
        params.push(clientId);
    }

    if (paid === '0' || paid === '1' || paid === 0 || paid === 1) {
        clauses.push('s.paid = ?');
        params.push(Number(paid));
    }

    const [rows] = await pool.execute(
        `SELECT
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
         WHERE ${clauses.join(' AND ')}
         ORDER BY s.sold_at DESC, s.id DESC`,
        params
    );

    return rows.map(mapSale);
}

async function getSaleById(id) {
    await ensureInvoiceSchema();

    const [rows] = await pool.execute(
        `SELECT
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
         WHERE s.id = ? AND s.active = 1
         LIMIT 1`,
        [id]
    );

    return rows.length ? mapSale(rows[0]) : null;
}

async function createSale(payload) {
    await ensureInvoiceSchema();

    const sale = normalizeSalePayload(payload);

    const [result] = await pool.execute(
        `INSERT INTO sales
            (client_id, product_id, quantity, unit_price, price, sold_at, paid, payment_source, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
            sale.client_id,
            sale.product_id,
            sale.quantity,
            sale.unit_price,
            sale.price,
            sale.sold_at,
            sale.paid,
            sale.payment_source
        ]
    );

    return getSaleById(result.insertId);
}

async function updateSale(id, payload) {
    await ensureInvoiceSchema();
    await assertSaleCanMutate(id, 'editar');

    const sale = normalizeSalePayload(payload);

    await pool.execute(
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
        [
            sale.client_id,
            sale.product_id,
            sale.quantity,
            sale.unit_price,
            sale.price,
            sale.sold_at,
            sale.paid,
            sale.payment_source,
            id
        ]
    );

    return getSaleById(id);
}

async function deactivateSale(id) {
    await ensureInvoiceSchema();
    await assertSaleCanMutate(id, 'inactivar');

    await pool.execute('UPDATE sales SET active = 0 WHERE id = ?', [id]);
}

module.exports = {
    createSale,
    deactivateSale,
    getSaleById,
    listSales,
    updateSale
};
