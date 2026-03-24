const { randomUUID } = require('crypto');
const pool = require('../config/db');

let ensurePromise = null;

async function ensureInvoiceSchema() {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                public_id CHAR(36) NOT NULL UNIQUE,
                sequence_number INT NULL UNIQUE,
                invoice_number VARCHAR(32) NULL UNIQUE,
                client_id INT NOT NULL,
                client_name VARCHAR(255) NOT NULL,
                client_phone VARCHAR(64) NULL,
                client_address VARCHAR(255) NULL,
                client_complemento VARCHAR(255) NULL,
                status ENUM('PENDIENTE', 'PAGADA') NOT NULL DEFAULT 'PENDIENTE',
                issue_date DATE NOT NULL,
                payment_source VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE',
                paid_at DATE NULL,
                subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
                total DECIMAL(12, 2) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_invoices_client_date (client_id, issue_date),
                INDEX idx_invoices_status (status),
                INDEX idx_invoices_number (invoice_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                sale_id INT NOT NULL,
                line_order INT NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(12, 2) NOT NULL,
                line_total DECIMAL(12, 2) NOT NULL,
                sold_at DATE NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_invoice_item_sale (sale_id),
                INDEX idx_invoice_items_invoice (invoice_id, line_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [publicIdColumns] = await pool.query(`SHOW COLUMNS FROM invoices LIKE 'public_id'`);

        if (!publicIdColumns.length) {
            await pool.query(`
                ALTER TABLE invoices
                ADD COLUMN public_id CHAR(36) NULL AFTER id,
                ADD UNIQUE KEY uniq_invoices_public_id (public_id)
            `);
        }

        const [rowsWithoutPublicId] = await pool.query(`
            SELECT id
            FROM invoices
            WHERE public_id IS NULL OR public_id = ''
        `);

        for (const row of rowsWithoutPublicId) {
            await pool.execute(
                `UPDATE invoices
                 SET public_id = ?
                 WHERE id = ?`,
                [randomUUID(), row.id]
            );
        }
    })();

    try {
        await ensurePromise;
    } catch (error) {
        ensurePromise = null;
        throw error;
    }
}

module.exports = {
    ensureInvoiceSchema
};
