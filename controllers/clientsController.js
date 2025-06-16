const pool   = require('../config/db');
const crypto = require('crypto');
const SECRET = process.env.HASH_SECRET || 'cambiame_por_algo_secreto';

/**
 * Genera un SHA-1 hash a partir del SECRET + id
 */
function hashId(id) {
    return crypto
        .createHash('sha1')
        .update(SECRET + id)
        .digest('hex');
}

/**
 * Listar clientes (opcionalmente filtrados por búsqueda) y adjuntar hash para edición
 */
exports.list = async (req, res) => {
    const searchTerm = req.query.search || '';
    let sql    = 'SELECT * FROM clients';
    const params = [];

    if (searchTerm) {
        sql    += ' WHERE name LIKE ? OR phone LIKE ?';
        const like = `%${searchTerm}%`;
        params.push(like, like);
    }
    sql += ' ORDER BY name';

    try {
        const [rows] = await pool.execute(sql, params);
        const clients = rows.map(r => ({
            ...r,
            hash: hashId(r.id)
        }));

        res.render('clients/index', {
            clients,
            search: searchTerm,
            error: null
        });
    } catch (err) {
        console.error('Error loading clients:', err);
        res.render('clients/index', {
            clients: [],
            search: searchTerm,
            error: 'Error al cargar clientes.'
        });
    }
};

/**
 * Mostrar formulario para crear un nuevo cliente
 */
exports.showNew = (req, res) => {
    res.render('clients/new', {
        client: { name: '', phone: '', address: '' },
        error:  null
    });
};

/**
 * Procesar creación de cliente
 */
exports.create = async (req, res) => {
    const { name, phone, address } = req.body || {};
    if (!name) {
        return res.render('clients/new', {
            client: { name, phone, address },
            error:  'El nombre es obligatorio.'
        });
    }

    try {
        await pool.execute(
            'INSERT INTO clients (name, phone, address) VALUES (?, ?, ?)',
            [name, phone, address]
        );
        res.redirect('/clients');
    } catch (err) {
        console.error('Error creating client:', err);
        res.render('clients/new', {
            client: { name, phone, address },
            error:  'Error al guardar el cliente.'
        });
    }
};

/**
 * Mostrar formulario para editar un cliente existente (buscado por hash)
 */
exports.showEdit = async (req, res) => {
    const { hash } = req.params;
    try {
        const [rows] = await pool.execute(
            // Forzamos BINARY para evitar mix de collations
            'SELECT * FROM clients WHERE BINARY SHA1(CONCAT(?, id)) = BINARY ?',
            [SECRET, hash]
        );

        if (!rows.length) {
            return res.redirect('/clients');
        }

        const client = rows[0];
        client.hash = hash;
        res.render('clients/edit', { client, error: null });
    } catch (err) {
        console.error('Error fetching client for edit:', err);
        res.redirect('/clients');
    }
};

/**
 * Procesar actualización de cliente existente (identificado por hash)
 */
exports.update = async (req, res) => {
    const { hash } = req.params;
    const { name, phone, address } = req.body || {};

    if (!name) {
        return res.render('clients/edit', {
            client: { id: hash, name, phone, address },
            error:  'El nombre es obligatorio.'
        });
    }

    try {
        await pool.execute(
            // Aquí también forzamos BINARY en la condición
            'UPDATE clients SET name = ?, phone = ?, address = ? WHERE BINARY SHA1(CONCAT(?, id)) = BINARY ?',
            [name, phone, address, SECRET, hash]
        );
        res.redirect('/clients');
    } catch (err) {
        console.error('Error updating client:', err);
        res.render('clients/edit', {
            client: { id: hash, name, phone, address },
            error:  'Error al actualizar el cliente.'
        });
    }
};
