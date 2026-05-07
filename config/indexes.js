const pool = require('./db');

async function ensureIndexes() {
    const indexes = [
        {
            name: 'idx_sales_sold_at',
            table: 'sales',
            column: 'sold_at'
        },
        {
            name: 'idx_sales_client_id',
            table: 'sales',
            column: 'client_id'
        },
        {
            name: 'idx_sales_active',
            table: 'sales',
            column: 'active'
        },
        {
            name: 'idx_sales_paid',
            table: 'sales',
            column: 'paid'
        },
        {
            name: 'idx_movements_date',
            table: 'movements',
            column: 'date'
        },
        {
            name: 'idx_movements_type',
            table: 'movements',
            column: 'type'
        },
        {
            name: 'idx_appointments_date',
            table: 'appointments',
            column: 'appointment_date'
        },
        {
            name: 'idx_appointments_status',
            table: 'appointments',
            column: 'status'
        },
        {
            name: 'idx_invoice_items_invoice_id',
            table: 'invoice_items',
            column: 'invoice_id'
        },
        {
            name: 'idx_invoices_status',
            table: 'invoices',
            column: 'status'
        },
        {
            name: 'idx_appointment_blocks_date',
            table: 'appointment_blocks',
            column: 'block_date'
        }
    ];

    for (const idx of indexes) {
        try {
            const [rows] = await pool.query(
                `SELECT COUNT(*) AS cnt FROM information_schema.statistics
                 WHERE table_schema = DATABASE()
                   AND table_name = ?
                   AND index_name = ?`,
                [idx.table, idx.name]
            );

            if (rows[0].cnt === 0) {
                await pool.query(
                    `CREATE INDEX ${idx.name} ON ${idx.table} (${idx.column})`
                );
                console.log(`Indice creado: ${idx.name} en ${idx.table}(${idx.column})`);
            }
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                continue;
            }
            console.warn(`No se pudo crear indice ${idx.name}: ${err.message}`);
        }
    }
}

module.exports = { ensureIndexes };
