const pool = require('../config/db');
const { SECRET, hashId, hashedLookupClause } = require('../config/encryption');
const { formatProperCase } = require('../utils/properCase');

let ensurePromise = null;

async function ensureProductSchema() {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        const [columns] = await pool.query(
            `SHOW COLUMNS FROM products LIKE 'duration_minutes'`
        );

        if (!columns.length) {
            await pool.query(`
                ALTER TABLE products
                ADD COLUMN duration_minutes INT NOT NULL DEFAULT 60 AFTER price
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

function mapProduct(row) {
    return {
        id: row.id,
        hash: hashId(row.id),
        name: formatProperCase(row.name),
        price: Number(row.price),
        duration_minutes: Number(row.duration_minutes || 60)
    };
}

async function listProducts({ search = '' } = {}) {
    await ensureProductSchema();

    const term = search.trim();
    const params = [];
    let sql = 'SELECT * FROM products';

    if (term) {
        sql += ' WHERE name LIKE ?';
        params.push(`%${term}%`);
    }

    sql += ' ORDER BY name';

    const [rows] = await pool.execute(sql, params);
    return rows.map(mapProduct);
}

async function getProductByHash(hash) {
    await ensureProductSchema();

    const [rows] = await pool.execute(
        `SELECT * FROM products WHERE ${hashedLookupClause()}`,
        [SECRET, hash]
    );

    return rows.length ? mapProduct(rows[0]) : null;
}

async function createProduct({ name, price, duration_minutes }) {
    await ensureProductSchema();

    const [result] = await pool.execute(
        'INSERT INTO products (name, price, duration_minutes) VALUES (?, ?, ?)',
        [name, price, duration_minutes || 60]
    );

    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [
        result.insertId
    ]);

    return mapProduct(rows[0]);
}

async function updateProduct(hash, { name, price, duration_minutes }) {
    await ensureProductSchema();

    await pool.execute(
        `UPDATE products
            SET name = ?, price = ?, duration_minutes = ?
          WHERE ${hashedLookupClause()}`,
        [name, price, duration_minutes || 60, SECRET, hash]
    );

    return getProductByHash(hash);
}

module.exports = {
    createProduct,
    ensureProductSchema,
    getProductByHash,
    listProducts,
    updateProduct
};
