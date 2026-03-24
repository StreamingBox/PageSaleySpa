const pool = require('../config/db');
const { SECRET, hashId, hashedLookupClause } = require('../config/encryption');
const { formatProperCase } = require('../utils/properCase');
const { ensureInvoiceSchema } = require('./invoicesSchemaService');

let ensurePromise = null;

async function ensureClientSchema() {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        const [columns] = await pool.query(`SHOW COLUMNS FROM clients LIKE 'avatar_emoji'`);

        if (!columns.length) {
            await pool.query(`
                ALTER TABLE clients
                ADD COLUMN avatar_emoji VARCHAR(16) NULL AFTER complemento
            `);
        }
    })();

    try {
        await ensurePromise;
    } catch (error) {
        ensurePromise = null;
        throw error;
    }
}

function mapClient(row) {
    return {
        id: row.id,
        hash: hashId(row.id),
        name: formatProperCase(row.name),
        phone: row.phone || '',
        address: row.address || '',
        complemento: row.complemento || '',
        avatar_emoji: row.avatar_emoji || ''
    };
}

function mapClientProfileSale(row) {
    return {
        id: Number(row.id),
        sold_at: row.sold_at ? new Date(row.sold_at).toISOString().slice(0, 10) : '',
        product_name: formatProperCase(row.product_name),
        quantity: Number(row.quantity || 0),
        total: Number(row.price || 0),
        paid: Number(row.paid || 0),
        invoice_public_id: row.invoice_public_id || '',
        invoice_number: row.invoice_number || ''
    };
}

function mapClientProfileInvoice(row) {
    return {
        public_id: row.public_id || '',
        invoice_number: row.invoice_number || '',
        issue_date: row.issue_date ? new Date(row.issue_date).toISOString().slice(0, 10) : '',
        total: Number(row.total || 0),
        status: row.status || 'PENDIENTE'
    };
}

function resolveClientTier(summary) {
    if (summary.total_spent >= 1500000 || summary.sales_count >= 12) {
        return 'Cliente Preferente';
    }

    if (summary.total_spent >= 500000 || summary.sales_count >= 5) {
        return 'Cliente Frecuente';
    }

    return 'Cliente Activo';
}

async function getClientRowByHash(hash) {
    await ensureClientSchema();

    const [rows] = await pool.execute(
        `SELECT * FROM clients WHERE ${hashedLookupClause()}`,
        [SECRET, hash]
    );

    return rows.length ? rows[0] : null;
}

async function listClients({ search = '' } = {}) {
    await ensureClientSchema();

    const term = search.trim();
    const params = [];
    let sql = 'SELECT * FROM clients';

    if (term) {
        const like = `%${term}%`;
        sql += ' WHERE name LIKE ? OR phone LIKE ? OR address LIKE ? OR complemento LIKE ?';
        params.push(like, like, like, like);
    }

    sql += ' ORDER BY name';

    const [rows] = await pool.execute(sql, params);
    return rows.map(mapClient);
}

async function getClientByHash(hash) {
    const row = await getClientRowByHash(hash);
    return row ? mapClient(row) : null;
}

async function createClient({ name, phone, address, complemento }) {
    await ensureClientSchema();

    const [result] = await pool.execute(
        'INSERT INTO clients (name, phone, address, complemento, avatar_emoji) VALUES (?, ?, ?, ?, ?)',
        [name, phone || null, address || null, complemento || null, null]
    );

    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [
        result.insertId
    ]);

    return mapClient(rows[0]);
}

async function updateClient(hash, { name, phone, address, complemento }) {
    await ensureClientSchema();

    await pool.execute(
        `UPDATE clients
            SET name = ?, phone = ?, address = ?, complemento = ?
          WHERE ${hashedLookupClause()}`,
        [name, phone || null, address || null, complemento || null, SECRET, hash]
    );

    return getClientByHash(hash);
}

async function updateClientAvatar(hash, avatarEmoji) {
    await ensureClientSchema();

    await pool.execute(
        `UPDATE clients
            SET avatar_emoji = ?
          WHERE ${hashedLookupClause()}`,
        [avatarEmoji || null, SECRET, hash]
    );

    return getClientByHash(hash);
}

async function getClientProfileByHash(hash) {
    await ensureInvoiceSchema();

    const clientRow = await getClientRowByHash(hash);
    if (!clientRow) {
        return null;
    }

    const client = mapClient(clientRow);

    const [[summaryRow]] = await pool.execute(
        `SELECT
            COUNT(*) AS sales_count,
            COALESCE(SUM(s.price), 0) AS total_spent,
            COALESCE(SUM(CASE WHEN s.paid = 0 THEN s.price ELSE 0 END), 0) AS pending_balance,
            MAX(s.sold_at) AS last_sale_at
         FROM sales s
         WHERE s.client_id = ? AND s.active = 1`,
        [client.id]
    );

    const [[invoiceSummaryRow]] = await pool.execute(
        `SELECT
            COUNT(*) AS invoices_count,
            MAX(i.issue_date) AS last_invoice_at
         FROM invoices i
         WHERE i.client_id = ?`,
        [client.id]
    );

    const [salesRows] = await pool.execute(
        `SELECT
            s.id,
            s.sold_at,
            s.quantity,
            s.price,
            s.paid,
            p.name AS product_name,
            i.public_id AS invoice_public_id,
            i.invoice_number
         FROM sales s
         JOIN products p ON p.id = s.product_id
         LEFT JOIN invoice_items ii ON ii.sale_id = s.id
         LEFT JOIN invoices i ON i.id = ii.invoice_id
         WHERE s.client_id = ? AND s.active = 1
         ORDER BY s.sold_at DESC, s.id DESC
         LIMIT 6`,
        [client.id]
    );

    const [invoiceRows] = await pool.execute(
        `SELECT
            i.public_id,
            i.invoice_number,
            i.issue_date,
            i.total,
            i.status
         FROM invoices i
         WHERE i.client_id = ?
         ORDER BY i.issue_date DESC, i.id DESC
         LIMIT 6`,
        [client.id]
    );

    const summary = {
        sales_count: Number(summaryRow?.sales_count || 0),
        total_spent: Number(summaryRow?.total_spent || 0),
        pending_balance: Number(summaryRow?.pending_balance || 0),
        invoices_count: Number(invoiceSummaryRow?.invoices_count || 0),
        last_sale_at: summaryRow?.last_sale_at
            ? new Date(summaryRow.last_sale_at).toISOString().slice(0, 10)
            : '',
        last_invoice_at: invoiceSummaryRow?.last_invoice_at
            ? new Date(invoiceSummaryRow.last_invoice_at).toISOString().slice(0, 10)
            : ''
    };

    return {
        client,
        summary: {
            ...summary,
            tier_label: resolveClientTier(summary)
        },
        recent_sales: salesRows.map(mapClientProfileSale),
        recent_invoices: invoiceRows.map(mapClientProfileInvoice)
    };
}

module.exports = {
    createClient,
    getClientByHash,
    getClientProfileByHash,
    listClients,
    updateClient,
    updateClientAvatar
};
