const Cat = require('../models/categoriesModel');

// ── Listar ───────────────────────────────
exports.index = async (req, res, next) => {
    try {
        const [categories] = await Cat.findAll();
        res.render('categories/index', { categories });
    } catch (err) { next(err); }
};

// ── Formulario nuevo ─────────────────────
exports.newForm = (req, res) => {
    res.render('categories/form', { category: {} });
};

// ── Crear ────────────────────────────────
exports.create = async (req, res, next) => {
    try {
        await Cat.create({ name: req.body.name.trim() });
        res.redirect('/categories');
    } catch (err) { next(err); }
};

// ── Formulario editar ────────────────────
exports.editForm = async (req, res, next) => {
    try {
        const [[category]] = await Cat.findById(req.params.id);
        if (!category) return res.redirect('/categories');
        res.render('categories/form', { category });
    } catch (err) { next(err); }
};

// ── Actualizar ───────────────────────────
exports.update = async (req, res, next) => {
    try {
        await Cat.update(req.params.id, { name: req.body.name.trim() });
        res.redirect('/categories');
    } catch (err) { next(err); }
};

// ── Eliminar ─────────────────────────────
exports.delete = async (req, res, next) => {
    try {
        await Cat.delete(req.params.id);
        res.redirect('/categories');
    } catch (err) { next(err); }
};
