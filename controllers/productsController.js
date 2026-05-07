const pool   = require('../config/db');
const { hashId, SECRET } = require('../config/encryption');

/* ---------- CRUD ---------- */

/* Listar productos */
exports.list = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM products ORDER BY name');
        const products = rows.map(r => ({ ...r, hash: hashId(r.id) }));
        res.render('products/index', { products, error: null });
    } catch (err) {
        console.error('Error loading products:', err);
        res.render('products/index', { products: [], error: 'Error al cargar productos.' });
    }
};

/* Mostrar formulario de alta */
exports.showNew = (req, res) => {
    res.render('products/new', { product: { name: '', price: '' }, error: null });
};

/* Crear producto */
exports.create = async (req, res) => {
    const { name, price } = req.body || {};
    if (!name || !price) {
        return res.render('products/new', { product: { name, price }, error: 'Nombre y precio son obligatorios.' });
    }

    try {
        await pool.execute('INSERT INTO products (name, price) VALUES (?, ?)', [name, price]);
        res.redirect('/products');
    } catch (err) {
        console.error('Error creating product:', err);
        res.render('products/new', { product: { name, price }, error: 'Error al guardar el producto.' });
    }
};

/* Formulario edición */
exports.showEdit = async (req, res) => {
    const { hash } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM products WHERE BINARY SHA1(CONCAT(?, id)) = BINARY ?',
            [SECRET, hash]
        );
        if (!rows.length) return res.redirect('/products');
        const product = { ...rows[0], hash };
        res.render('products/edit', { product, error: null });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.redirect('/products');
    }
};

/* Actualizar producto */
exports.update = async (req, res) => {
    const { hash } = req.params;
    const { name, price } = req.body || {};
    if (!name || !price) {
        return res.render('products/edit', { product: { hash, name, price }, error: 'Nombre y precio son obligatorios.' });
    }

    try {
        await pool.execute(
            'UPDATE products SET name = ?, price = ? WHERE BINARY SHA1(CONCAT(?, id)) = BINARY ?',
            [name, price, SECRET, hash]
        );
        res.redirect('/products');
    } catch (err) {
        console.error('Error updating product:', err);
        res.render('products/edit', { product: { hash, name, price }, error: 'Error al actualizar el producto.' });
    }
};
