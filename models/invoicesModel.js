/* models/invoicesModel.js */
const pool = require('../config/db');

module.exports = {
    // ── Invoices ──────────────────────────────────────────────────────────────

    findAll: (clauses = ['1 = 1'], params = []) =>
        pool.execute(
            `SELECT
                i.*,
                (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS lines_count
             FROM invoices i
             WHERE ${clauses.join(' AND ')}
             ORDER BY i.issue_date DESC, i.sequence_number DESC`,
            params
        ),

    findById: (id) =>
        pool.execute(
            `SELECT
                i.*,
                (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS lines_count
             FROM invoices i
             WHERE i.id = ?
             LIMIT 1`,
            [id]
        ),

    findByPublicId: (publicId) =>
        pool.execute(
            `SELECT
                i.*,
                (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS lines_count
             FROM invoices i
             WHERE i.public_id = ?
             LIMIT 1`,
            [publicId]
        ),

    create: ({
        public_id, client_id, client_name, client_phone, client_address,
        client_complemento, issue_date, subtotal, total
    }) =>
        pool.execute(
            `INSERT INTO invoices (
                public_id, client_id, client_name, client_phone, client_address,
                client_complemento, status, issue_date, payment_source, paid_at, subtotal, total
             ) VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, 'PENDIENTE', NULL, ?, ?)`,
            [
                public_id, client_id, client_name,
                client_phone || null, client_address || null, client_complemento || null,
                issue_date, subtotal, total
            ]
        ),

    setSequenceNumber: (id, sequenceNumber, invoiceNumber) =>
        pool.execute(
            'UPDATE invoices SET sequence_number = ?, invoice_number = ? WHERE id = ?',
            [sequenceNumber, invoiceNumber, id]
        ),

    markPaid: (id, paymentSource, paidAt) =>
        pool.execute(
            `UPDATE invoices
             SET status = 'PAGADA', payment_source = ?, paid_at = ?
             WHERE id = ?`,
            [paymentSource, paidAt, id]
        ),

    // ── Invoice Items ─────────────────────────────────────────────────────────

    findItemsByInvoiceId: (invoiceId) =>
        pool.execute(
            `SELECT * FROM invoice_items
             WHERE invoice_id = ?
             ORDER BY sold_at ASC, line_order ASC, id ASC`,
            [invoiceId]
        ),

    findItemBySaleId: (saleId) =>
        pool.execute(
            `SELECT ii.*, i.public_id, i.invoice_number, i.status
             FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             WHERE ii.sale_id = ?
             LIMIT 1`,
            [saleId]
        ),

    insertItems: (itemRows) => {
        const placeholders = itemRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = [];
        itemRows.forEach(r => {
            params.push(
                r.invoice_id, r.sale_id, r.line_order,
                r.product_name, r.quantity, r.unit_price, r.line_total, r.sold_at
            );
        });
        return pool.execute(
            `INSERT INTO invoice_items
                (invoice_id, sale_id, line_order, product_name, quantity, unit_price, line_total, sold_at)
             VALUES ${placeholders}`,
            params
        );
    },

    // ── Candidates ──────────────────────────────────────────────────────────

    findCandidatesByClient: (clientId) =>
        pool.execute(
            `SELECT
                s.id, s.client_id, c.name AS client_name, s.product_id,
                p.name AS product_name, s.quantity, s.unit_price, s.price,
                s.sold_at, s.paid, s.payment_source
             FROM sales s
             JOIN clients c ON c.id = s.client_id
             JOIN products p ON p.id = s.product_id
             LEFT JOIN invoice_items ii ON ii.sale_id = s.id
             WHERE s.active = 1
               AND s.client_id = ?
               AND s.paid = 0
               AND ii.sale_id IS NULL
             ORDER BY s.sold_at ASC, s.id ASC`,
            [clientId]
        ),

    // ── Update sales when paid ──────────────────────────────────────────────

    markSalesPaidByInvoice: (invoiceId, paymentSource) =>
        pool.execute(
            `UPDATE sales s
             JOIN invoice_items ii ON ii.sale_id = s.id
             SET s.paid = 1, s.payment_source = ?
             WHERE ii.invoice_id = ?`,
            [paymentSource, invoiceId]
        )
};
