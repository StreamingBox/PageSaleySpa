const { randomUUID } = require('crypto');
const pool = require('../config/db');
const { formatProperCase } = require('../utils/properCase');
const { parseIsoDate, toExclusiveEnd, toIsoDate } = require('../utils/dateRange');
const { createAppError } = require('../utils/appError');
const { ensureInvoiceSchema } = require('./invoicesSchemaService');

function formatInvoiceNumber(sequenceNumber) {
    return `FAC-${String(sequenceNumber).padStart(6, '0')}`;
}

function mapInvoiceRow(row) {
    return {
        id: row.id,
        public_id: row.public_id || '',
        sequence_number: Number(row.sequence_number || 0),
        invoice_number: row.invoice_number,
        client_id: Number(row.client_id),
        client_name: formatProperCase(row.client_name),
        client_phone: row.client_phone || '',
        client_address: row.client_address || '',
        client_complemento: row.client_complemento || '',
        status: row.status,
        issue_date: toIsoDate(new Date(row.issue_date)),
        payment_source: row.payment_source || 'PENDIENTE',
        paid_at: row.paid_at ? toIsoDate(new Date(row.paid_at)) : '',
        subtotal: Number(row.subtotal || 0),
        total: Number(row.total || 0),
        lines_count: Number(row.lines_count || 0),
        created_at: row.created_at ? toIsoDate(new Date(row.created_at)) : '',
        updated_at: row.updated_at ? toIsoDate(new Date(row.updated_at)) : ''
    };
}

function mapInvoiceItemRow(row) {
    return {
        id: row.id,
        invoice_id: Number(row.invoice_id),
        sale_id: Number(row.sale_id),
        line_order: Number(row.line_order),
        product_name: formatProperCase(row.product_name),
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        line_total: Number(row.line_total),
        sold_at: toIsoDate(new Date(row.sold_at))
    };
}

function normalizeInvoiceDate(value, fieldLabel) {
    const parsed = parseIsoDate(value || toIsoDate(new Date()));

    if (!parsed) {
        throw createAppError(400, `La ${fieldLabel} no es válida`);
    }

    return toIsoDate(parsed);
}

function normalizeSaleIds(saleIds) {
    if (!Array.isArray(saleIds) || !saleIds.length) {
        throw createAppError(400, 'Debes seleccionar al menos una venta');
    }

    const normalized = [...new Set(saleIds.map(value => Number(value)).filter(Number.isInteger))];

    if (!normalized.length) {
        throw createAppError(400, 'No encontré ventas válidas para facturar');
    }

    return normalized;
}

function normalizeInvoiceIds(invoiceIds) {
    if (!Array.isArray(invoiceIds) || invoiceIds.length < 2) {
        throw createAppError(400, 'Debes seleccionar al menos dos facturas para unificarlas');
    }

    const normalized = [
        ...new Set(invoiceIds.map(value => Number(value)).filter(Number.isInteger))
    ].filter(value => value > 0);

    if (normalized.length < 2) {
        throw createAppError(400, 'Debes seleccionar al menos dos facturas válidas');
    }

    return normalized;
}

function compareRowsBySoldAtAsc(left, right) {
    const leftTime = new Date(left.sold_at).getTime();
    const rightTime = new Date(right.sold_at).getTime();

    if (leftTime !== rightTime) {
        return leftTime - rightTime;
    }

    return Number(left.id || 0) - Number(right.id || 0);
}

function normalizeInvoiceLookup(value) {
    const raw = String(value || '').trim();

    if (!raw) {
        return null;
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return {
            clause: 'i.public_id = ?',
            value: raw
        };
    }

    const numericId = Number(raw);
    if (Number.isInteger(numericId) && numericId > 0) {
        return {
            clause: 'i.id = ?',
            value: numericId
        };
    }

    return null;
}

async function fetchInvoiceRow(executor, identifier) {
    const lookup = normalizeInvoiceLookup(identifier);
    if (!lookup) {
        return null;
    }

    const [rows] = await executor.execute(
        `SELECT
            i.*,
            (
                SELECT COUNT(*)
                FROM invoice_items ii
                WHERE ii.invoice_id = i.id
            ) AS lines_count
         FROM invoices i
         WHERE ${lookup.clause}
         LIMIT 1`,
        [lookup.value]
    );

    return rows.length ? mapInvoiceRow(rows[0]) : null;
}

async function fetchInvoiceItems(executor, id) {
    const [rows] = await executor.execute(
        `SELECT *
         FROM invoice_items
         WHERE invoice_id = ?
         ORDER BY sold_at ASC, line_order ASC, id ASC`,
        [id]
    );

    return rows.map(mapInvoiceItemRow);
}

async function getInvoiceById(id, executor = pool) {
    await ensureInvoiceSchema();
    const invoice = await fetchInvoiceRow(executor, id);
    if (!invoice) {
        return null;
    }

    return {
        ...invoice,
        items: await fetchInvoiceItems(executor, invoice.id)
    };
}

async function listInvoices({ start, end, clientId, status, search }) {
    await ensureInvoiceSchema();

    const clauses = ['1 = 1'];
    const params = [];

    if (start) {
        const parsedStart = parseIsoDate(start);
        if (parsedStart) {
            clauses.push('i.issue_date >= ?');
            params.push(toIsoDate(parsedStart));
        }
    }

    if (end) {
        const parsedEnd = parseIsoDate(end);
        if (parsedEnd) {
            clauses.push('i.issue_date < ?');
            params.push(toIsoDate(toExclusiveEnd(parsedEnd)));
        }
    }

    if (clientId) {
        clauses.push('i.client_id = ?');
        params.push(Number(clientId));
    }

    if (status === 'PENDIENTE' || status === 'PAGADA') {
        clauses.push('i.status = ?');
        params.push(status);
    }

    if (search && String(search).trim()) {
        const term = `%${String(search).trim()}%`;
        clauses.push('(i.invoice_number LIKE ? OR i.client_name LIKE ?)');
        params.push(term, term);
    }

    const [rows] = await pool.execute(
        `SELECT
            i.*,
            (
                SELECT COUNT(*)
                FROM invoice_items ii
                WHERE ii.invoice_id = i.id
            ) AS lines_count
         FROM invoices i
         WHERE ${clauses.join(' AND ')}
         ORDER BY i.issue_date DESC, i.sequence_number DESC`,
        params
    );

    return rows.map(mapInvoiceRow);
}

async function listInvoiceCandidates(clientId) {
    await ensureInvoiceSchema();

    const normalizedClientId = Number(clientId);
    if (!Number.isInteger(normalizedClientId) || normalizedClientId <= 0) {
        throw createAppError(400, 'Selecciona un cliente para consultar ventas facturables');
    }

    const [rows] = await pool.execute(
        `SELECT
            s.id,
            s.client_id,
            c.name AS client_name,
            s.product_id,
            p.name AS product_name,
            s.quantity,
            s.unit_price,
            s.price,
            s.sold_at,
            s.paid,
            s.payment_source
         FROM sales s
         JOIN clients c ON c.id = s.client_id
         JOIN products p ON p.id = s.product_id
         LEFT JOIN invoice_items ii ON ii.sale_id = s.id
         WHERE s.active = 1
           AND s.client_id = ?
           AND s.paid = 0
           AND ii.sale_id IS NULL
         ORDER BY s.sold_at ASC, s.id ASC`,
        [normalizedClientId]
    );

    return rows.map(row => ({
        id: Number(row.id),
        client_id: Number(row.client_id),
        client_name: formatProperCase(row.client_name),
        product_name: formatProperCase(row.product_name),
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        price: Number(row.price),
        sold_at: toIsoDate(new Date(row.sold_at)),
        paid: Number(row.paid),
        payment_source: row.payment_source || 'PENDIENTE'
    }));
}

async function createInvoice({ client_id, sale_ids, issue_date }) {
    await ensureInvoiceSchema();

    const saleIds = normalizeSaleIds(sale_ids);
    const clientId = Number(client_id);

    if (!Number.isInteger(clientId) || clientId <= 0) {
        throw createAppError(400, 'Selecciona un cliente válido');
    }

    const issueDate = normalizeInvoiceDate(issue_date, 'fecha de emisión');
    const publicId = randomUUID();
    const placeholders = saleIds.map(() => '?').join(', ');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [salesRows] = await connection.execute(
            `SELECT
                s.id,
                s.client_id,
                s.active,
                s.paid,
                s.quantity,
                s.unit_price,
                s.price,
                s.sold_at,
                c.name AS client_name,
                c.phone AS client_phone,
                c.address AS client_address,
                c.complemento AS client_complemento,
                p.name AS product_name,
                ii.invoice_id
             FROM sales s
             JOIN clients c ON c.id = s.client_id
             JOIN products p ON p.id = s.product_id
             LEFT JOIN invoice_items ii ON ii.sale_id = s.id
             WHERE s.id IN (${placeholders})
             FOR UPDATE`,
            saleIds
        );

        if (salesRows.length !== saleIds.length) {
            throw createAppError(404, 'Una o más ventas ya no existen');
        }

        const salesById = new Map(salesRows.map(row => [Number(row.id), row]));
        const orderedSales = saleIds
            .map(saleId => salesById.get(saleId))
            .sort(compareRowsBySoldAtAsc);

        orderedSales.forEach(row => {
            if (Number(row.active) !== 1) {
                throw createAppError(409, 'No puedes facturar ventas inactivas');
            }

            if (Number(row.paid) === 1) {
                throw createAppError(409, 'Solo puedes facturar ventas pendientes');
            }

            if (row.invoice_id) {
                throw createAppError(409, 'Una de las ventas seleccionadas ya tiene factura');
            }

            if (Number(row.client_id) !== clientId) {
                throw createAppError(400, 'Todas las ventas deben pertenecer al mismo cliente');
            }
        });

        const firstSale = orderedSales[0];
        const subtotal = orderedSales.reduce((total, row) => total + Number(row.price || 0), 0);

        const [invoiceResult] = await connection.execute(
            `INSERT INTO invoices (
                public_id,
                client_id,
                client_name,
                client_phone,
                client_address,
                client_complemento,
                status,
                issue_date,
                payment_source,
                paid_at,
                subtotal,
                total
             ) VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, 'PENDIENTE', NULL, ?, ?)`,
            [
                publicId,
                clientId,
                firstSale.client_name,
                firstSale.client_phone || null,
                firstSale.client_address || null,
                firstSale.client_complemento || null,
                issueDate,
                subtotal,
                subtotal
            ]
        );

        const invoiceId = Number(invoiceResult.insertId);
        const sequenceNumber = invoiceId;
        const invoiceNumber = formatInvoiceNumber(sequenceNumber);

        await connection.execute(
            `UPDATE invoices
             SET sequence_number = ?, invoice_number = ?
             WHERE id = ?`,
            [sequenceNumber, invoiceNumber, invoiceId]
        );

        const itemsParams = [];

        orderedSales.forEach((row, index) => {
            itemsParams.push(
                invoiceId,
                Number(row.id),
                index + 1,
                row.product_name,
                Number(row.quantity),
                Number(row.unit_price),
                Number(row.price),
                toIsoDate(new Date(row.sold_at))
            );
        });

        await connection.execute(
            `INSERT INTO invoice_items (
                invoice_id,
                sale_id,
                line_order,
                product_name,
                quantity,
                unit_price,
                line_total,
                sold_at
             ) VALUES ${orderedSales.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
            itemsParams
        );

        await connection.commit();
        return getInvoiceById(publicId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function markInvoicePaid(id, { payment_source, paid_at }) {
    await ensureInvoiceSchema();

    if (!payment_source || !String(payment_source).trim()) {
        throw createAppError(400, 'El origen de pago es obligatorio');
    }

    const paidDate = normalizeInvoiceDate(
        paid_at || toIsoDate(new Date()),
        'fecha de pago'
    );
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const invoice = await fetchInvoiceRow(connection, id);
        if (!invoice) {
            throw createAppError(404, 'Factura no encontrada');
        }

        if (invoice.status === 'PAGADA') {
            throw createAppError(409, 'La factura ya se encuentra pagada');
        }

        const paymentSource = String(payment_source).trim().toUpperCase();

        await connection.execute(
            `UPDATE invoices
             SET status = 'PAGADA',
                 payment_source = ?,
                 paid_at = ?
             WHERE id = ?`,
            [paymentSource, paidDate, invoice.id]
        );

        await connection.execute(
            `UPDATE sales s
             JOIN invoice_items ii ON ii.sale_id = s.id
             SET s.paid = 1,
                 s.payment_source = ?
             WHERE ii.invoice_id = ?`,
            [paymentSource, invoice.id]
        );

        await connection.commit();
        return getInvoiceById(invoice.public_id);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function mergeInvoices({ invoice_ids }) {
    await ensureInvoiceSchema();

    const invoiceIds = normalizeInvoiceIds(invoice_ids);
    const placeholders = invoiceIds.map(() => '?').join(', ');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [invoiceRows] = await connection.execute(
            `SELECT
                i.*,
                (
                    SELECT COUNT(*)
                    FROM invoice_items ii
                    WHERE ii.invoice_id = i.id
                ) AS lines_count
             FROM invoices i
             WHERE i.id IN (${placeholders})
             FOR UPDATE`,
            invoiceIds
        );

        if (invoiceRows.length !== invoiceIds.length) {
            throw createAppError(404, 'Una o más facturas ya no existen');
        }

        const invoices = invoiceRows.map(mapInvoiceRow).sort((left, right) => {
            const leftSequence = Number(left.sequence_number || left.id || 0);
            const rightSequence = Number(right.sequence_number || right.id || 0);

            if (leftSequence !== rightSequence) {
                return leftSequence - rightSequence;
            }

            return left.id - right.id;
        });

        const primaryInvoice = invoices[0];
        const primaryPublicId = primaryInvoice.public_id;
        const clientId = primaryInvoice.client_id;

        invoices.forEach(invoice => {
            if (invoice.client_id !== clientId) {
                throw createAppError(409, 'Solo puedes unificar facturas del mismo cliente');
            }

            if (invoice.status !== 'PENDIENTE') {
                throw createAppError(
                    409,
                    'Solo puedes unificar facturas pendientes. Las pagadas deben conservarse por separado'
                );
            }
        });

        const [itemRows] = await connection.execute(
            `SELECT *
             FROM invoice_items
             WHERE invoice_id IN (${placeholders})
             ORDER BY sold_at ASC, line_order ASC, id ASC
             FOR UPDATE`,
            invoiceIds
        );

        const orderedItems = itemRows
            .map(mapInvoiceItemRow)
            .sort((left, right) => {
                const soldAtDiff =
                    new Date(left.sold_at).getTime() - new Date(right.sold_at).getTime();

                if (soldAtDiff !== 0) {
                    return soldAtDiff;
                }

                if (left.invoice_id !== right.invoice_id) {
                    return left.invoice_id - right.invoice_id;
                }

                if (left.line_order !== right.line_order) {
                    return left.line_order - right.line_order;
                }

                return left.id - right.id;
            });

        for (const [index, item] of orderedItems.entries()) {
            await connection.execute(
                `UPDATE invoice_items
                 SET invoice_id = ?,
                     line_order = ?
                 WHERE id = ?`,
                [primaryInvoice.id, index + 1, item.id]
            );
        }

        const mergedTotal = orderedItems.reduce(
            (total, item) => total + Number(item.line_total || 0),
            0
        );

        await connection.execute(
            `UPDATE invoices
             SET subtotal = ?,
                 total = ?,
                 status = 'PENDIENTE',
                 payment_source = 'PENDIENTE',
                 paid_at = NULL
             WHERE id = ?`,
            [mergedTotal, mergedTotal, primaryInvoice.id]
        );

        const redundantInvoices = invoices.slice(1);

        if (redundantInvoices.length) {
            await connection.execute(
                `DELETE FROM invoices
                 WHERE id IN (${redundantInvoices.map(() => '?').join(', ')})`,
                redundantInvoices.map(invoice => invoice.id)
            );
        }

        await connection.commit();
        return getInvoiceById(primaryPublicId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getInvoiceForSaleId(saleId, executor = pool) {
    await ensureInvoiceSchema();

    const normalizedSaleId = Number(saleId);
    if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
        return null;
    }

    const [rows] = await executor.execute(
        `SELECT
            i.id,
            i.public_id,
            i.invoice_number,
            i.status
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE ii.sale_id = ?
         LIMIT 1`,
        [normalizedSaleId]
    );

    return rows.length
        ? {
              id: Number(rows[0].id),
              public_id: rows[0].public_id || '',
              invoice_number: rows[0].invoice_number,
              status: rows[0].status
          }
        : null;
}

async function assertSaleCanMutate(id, actionLabel) {
    const invoice = await getInvoiceForSaleId(id);

    if (invoice) {
        throw createAppError(
            409,
            `No puedes ${actionLabel} una venta que ya está incluida en la factura ${invoice.invoice_number}`
        );
    }
}

module.exports = {
    assertSaleCanMutate,
    createInvoice,
    getInvoiceById,
    getInvoiceForSaleId,
    listInvoiceCandidates,
    listInvoices,
    mergeInvoices,
    markInvoicePaid
};
