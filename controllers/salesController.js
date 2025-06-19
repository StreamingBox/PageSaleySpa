// controllers/salesController.js
const pool = require('../config/db');

/* ------------ helpers ------------ */
const money = n =>
    '$ ' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const fmtDate = d =>
    new Date(d).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

/* -------------------------- LIST ------------------------------ */
exports.list = async (req, res) => {
    try {
        // 1) Traer lista de clientes para el filtro
        const [clients] = await pool.execute(
            'SELECT id, name FROM clients ORDER BY name'
        );

        // 2) Leer filtros
        const { start, end, client_id, paid } = req.query;
        const clauses = ['s.active = 1'];
        const params = [];
        if (start)     { clauses.push('s.sold_at >= ?'); params.push(start); }
        if (end)       { clauses.push('s.sold_at <= ?'); params.push(end); }
        if (client_id) { clauses.push('s.client_id = ?'); params.push(client_id); }
        if (paid === '1' || paid === '0') {
            clauses.push('s.paid = ?');
            params.push(paid);
        }

        // 3) Consulta
        const sql = `
      SELECT s.*, c.name AS client_name, p.name AS product_name
        FROM sales s
        JOIN clients c ON c.id = s.client_id
        JOIN products p ON p.id = s.product_id
       WHERE ${clauses.join(' AND ')}
    ORDER BY s.sold_at DESC
    `;
        const [rows] = await pool.execute(sql, params);

        // 4) Formatear resultados
        const sales = rows.map(r => ({
            ...r,
            sold_at_fmt    : fmtDate(r.sold_at),
            unit_price_fmt : money(r.unit_price),
            total_fmt      : money(r.unit_price * r.quantity),
            paid_label     : r.paid ? 'Pagado' : 'Pendiente',
            origin_label   : r.paid ? (r.payment_source || '-') : 'Pendiente'
        }));

        // 5) Renderizar vista
        res.render('sales/index', {
            sales,
            clients,
            filters: { start, end, client_id, paid },
            error: null
        });
    } catch (err) {
        console.error('Error loading sales:', err);
        res.render('sales/index', {
            sales: [],
            clients: [],
            filters: { start: '', end: '', client_id: '', paid: '' },
            error: 'Error al cargar ventas.'
        });
    }
};

/* --------------------- FORM NUEVA VENTA ----------------------- */
exports.showNew = async (req, res) => {
    try {
        const [clients]  = await pool.execute('SELECT id, name FROM clients ORDER BY name');
        const [products] = await pool.execute('SELECT id, name, price FROM products ORDER BY name');
        res.render('sales/new', {
            sale: {
                client_id: '',
                product_id: '',
                quantity: 1,
                unit_price: 0,
                price: 0,
                sold_at: '',
                paid: 0,
                payment_source: ''
            },
            clients,
            products,
            error: null
        });
    } catch (err) {
        console.error(err);
        res.redirect('/sales');
    }
};

/* ---------------------- CREAR VENTA --------------------------- */
exports.create = async (req, res) => {
    const {
        client_id,
        product_id,
        quantity,
        unit_price,
        price,
        sold_at,
        paid,
        payment_source
    } = req.body;

    if (!client_id || !product_id || !sold_at || !quantity) {
        return res.redirect('/sales/new');
    }

    const isPaid = paid === '1' ? 1 : 0;

    try {
        await pool.execute(
            `INSERT INTO sales
       (client_id, product_id, quantity, unit_price, price,
        sold_at, paid, payment_source, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                client_id,
                product_id,
                parseInt(quantity, 10),
                parseFloat(unit_price),
                parseFloat(price),
                sold_at,
                isPaid,
                payment_source || null
            ]
        );
        res.redirect('/sales');
    } catch (err) {
        console.error('Error creating sale:', err);
        res.redirect('/sales');
    }
};

/* ------------------- FORM EDITAR VENTA ------------------------ */
exports.showEdit = async (req, res) => {
    const { id } = req.params;
    try {
        const [[sale]] = await pool.execute(
            `SELECT s.*, c.name AS client_name, p.name AS product_name
         FROM sales s
         JOIN clients c ON c.id = s.client_id
         JOIN products p ON p.id = s.product_id
        WHERE s.id = ? AND s.active = 1`,
            [id]
        );
        if (!sale) return res.redirect('/sales');

        const [clients]  = await pool.execute('SELECT id, name FROM clients ORDER BY name');
        const [products] = await pool.execute('SELECT id, name, price FROM products ORDER BY name');
        res.render('sales/edit', { sale, clients, products, error: null });
    } catch (err) {
        console.error(err);
        res.redirect('/sales');
    }
};

/* ------------------------ ACTUALIZAR -------------------------- */
exports.update = async (req, res) => {
    const { id } = req.params;
    const {
        client_id,
        product_id,
        quantity,
        unit_price,
        price,
        sold_at,
        paid,
        payment_source
    } = req.body;

    if (!client_id || !product_id || !sold_at || !quantity) {
        return res.redirect(`/sales/${id}/edit`);
    }

    const isPaid = paid === '1' ? 1 : 0;

    try {
        await pool.execute(
            `UPDATE sales
         SET client_id      = ?,
             product_id     = ?,
             quantity       = ?,
             unit_price     = ?,
             price          = ?,
             sold_at        = ?,
             paid           = ?,
             payment_source = ?
       WHERE id = ? AND active = 1`,
            [
                client_id,
                product_id,
                parseInt(quantity, 10),
                parseFloat(unit_price),
                parseFloat(price),
                sold_at,
                isPaid,
                payment_source || null,
                id
            ]
        );
        res.redirect('/sales');
    } catch (err) {
        console.error('Error updating sale:', err);
        res.redirect(`/sales/${id}/edit`);
    }
};

/* --------------------- DESACTIVAR (soft delete) --------------- */
exports.delete = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE sales SET active = 0 WHERE id = ?', [id]);
        res.redirect('/sales');
    } catch (err) {
        console.error('Error desactivando la venta:', err);
        res.redirect('/sales');
    }
};
