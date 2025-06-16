/* controllers/salesController.js */
const pool = require('../config/db');

/* ------------ helpers (sin dependencias externas) ------------ */
const money = n =>
    '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const fmtDate = d =>
    new Date(d).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

/* -------------------------- LIST ------------------------------ */
exports.list = async (req, res) => {
    const sql = `
    SELECT s.*, c.name AS client_name, p.name AS product_name
      FROM sales s
      JOIN clients  c ON c.id = s.client_id
      JOIN products p ON p.id = s.product_id
    ORDER BY s.sold_at DESC
  `;
    try {
        const [rows] = await pool.execute(sql);
        const sales = rows.map(r => ({
            ...r,
            sold_at_fmt : fmtDate(r.sold_at),
            price_fmt   : money(r.price),
            paid_label  : r.paid ? 'Pagado' : 'Debe',

            origin_label: r.paid
                ? (r.payment_source || '-')
                : 'Pendiente'          // o 'En mora'

        }));
        res.render('sales/index', { sales, error: null });
    } catch (err) {
        console.error('Error loading sales:', err);
        res.render('sales/index', { sales: [], error: 'Error al cargar ventas.' });
    }
};

/* --------------------- FORM NUEVA VENTA ----------------------- */
exports.showNew = async (req, res) => {
    try {
        const [clients]  = await pool.execute('SELECT id, name FROM clients ORDER BY name');
        const [products] = await pool.execute('SELECT id, name, price FROM products ORDER BY name');
        res.render('sales/new', {
            sale: { client_id:'', product_id:'', sold_at:'', paid:0, payment_source:'' },
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
    const { client_id, product_id, sold_at, paid, payment_source } = req.body;

    if (!client_id || !product_id || !sold_at) {
        return res.redirect('/sales/new');
    }

    try {
        /* Obtener precio vigente del producto */
        const [[product]] = await pool.execute(
            'SELECT price FROM products WHERE id = ? LIMIT 1',
            [product_id]
        );
        if (!product) return res.redirect('/sales/new');

        await pool.execute(
            `INSERT INTO sales
        (client_id, product_id, sold_at, price, paid, payment_source)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                client_id,
                product_id,
                sold_at,
                product.price,
                paid ? 1 : 0,
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
    const { id } = req.params;   // /sales/:id/edit
    try {
        const [[sale]] = await pool.execute(
            `SELECT s.*, c.id AS client_id, c.name AS client_name,
              p.id AS product_id, p.name AS product_name
         FROM sales s
         JOIN clients  c ON c.id = s.client_id
         JOIN products p ON p.id = s.product_id
        WHERE s.id = ?`,
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
    const { client_id, product_id, sold_at, paid, payment_source } = req.body;

    if (!client_id || !product_id || !sold_at) {
        return res.redirect(`/sales/${id}/edit`);
    }

    try {
        /* Precio actualizado del producto seleccionado */
        const [[product]] = await pool.execute(
            'SELECT price FROM products WHERE id = ? LIMIT 1',
            [product_id]
        );
        if (!product) return res.redirect(`/sales/${id}/edit`);

        await pool.execute(
            `UPDATE sales
          SET client_id = ?, product_id = ?, sold_at = ?,
              price = ?, paid = ?, payment_source = ?
        WHERE id = ?`,
            [
                client_id,
                product_id,
                sold_at,
                product.price,
                paid ? 1 : 0,
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
