/* controllers/movementsController.js */
const Mov = require('../models/movementsModel');
const Cat = require('../models/categoriesModel');   // ← nuevo
const fs  = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────
// LISTAR
// ────────────────────────────────────────────────────────────
exports.index = async (req, res, next) => {
    try {
        const [rows] = await Mov.findAll();
        res.render('movements/index', { movements: rows });
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────────
// FORMULARIO NUEVO
// ────────────────────────────────────────────────────────────
exports.newForm = async (req, res, next) => {
    try {
        const [categories] = await Cat.findAll();          // ← obtener categorías
        res.render('movements/form', { movement: {}, categories });
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────────
// CREAR
// ────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
    try {
        const attachment = req.file ? req.file.filename : null;

        // Validar tipo antes de guardar
        const validTypes = ['gasto', 'ingreso'];
        const type       = validTypes.includes(req.body.type) ? req.body.type : 'gasto';

        await Mov.create({ ...req.body, type, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────────
// FORMULARIO EDITAR
// ────────────────────────────────────────────────────────────
exports.editForm = async (req, res, next) => {
    try {
        const [[movement]]  = await Mov.findById(req.params.id);
        if (!movement) return res.redirect('/movements');

        const [categories]  = await Cat.findAll();         // ← obtener categorías
        res.render('movements/form', { movement, categories });
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────────
// ACTUALIZAR
// ────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
    try {
        // Manejar adjuntos
        let attachment = req.body.currentAttachment || null;
        if (req.file) {
            if (attachment) {
                fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', attachment));
            }
            attachment = req.file.filename;
        }

        // Validar tipo nuevamente
        const validTypes = ['gasto', 'ingreso'];
        const type       = validTypes.includes(req.body.type) ? req.body.type : 'gasto';

        await Mov.update(req.params.id, { ...req.body, type, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

// ────────────────────────────────────────────────────────────
// ELIMINAR
// ────────────────────────────────────────────────────────────
exports.delete = async (req, res, next) => {
    try {
        await Mov.delete(req.params.id);
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};
