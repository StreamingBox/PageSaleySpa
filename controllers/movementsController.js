const Mov = require('../models/movementsModel');
const Cat = require('../models/categoriesModel');
const fs  = require('fs');
const path = require('path');

/**
 * LISTAR (con filtros y paginación)
 * Query params soportados:
 *   - start: YYYY-MM-DD (incluyente)
 *   - end:   YYYY-MM-DD (incluyente)
 *   - page:  número de página (>=1)
 *
 * La vista recibe:
 *   - movements: filas de la página actual
 *   - filters: { start, end }
 *   - pagination: { page, totalPages, total, pageSize }
 *   - path: para navbar activo
 */
exports.index = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = 20;

        const start = (req.query.start || '').trim();
        const end   = (req.query.end   || '').trim();

        // Si tu modelo aún no tiene findPaged, añade el que te pasé:
        // const { rows, total } = await Mov.findPaged({ startDate: start || null, endDate: end || null, page, pageSize });
        // Mientras tanto, si tienes findAll() puedes hacer un fallback simple (menos eficiente):
        // Pero lo correcto es usar Mov.findPaged (recomendado).
        const hasFindPaged = typeof Mov.findPaged === 'function';

        let rows = [];
        let total = 0;

        if (hasFindPaged) {
            const result = await Mov.findPaged({
                startDate: start || null,
                endDate:   end   || null,
                page,
                pageSize
            });
            rows  = result.rows;
            total = result.total || 0;
        } else {
            // Fallback: trae todo y filtra/pagina en memoria (usa solo temporalmente)
            const [all] = await Mov.findAll();
            const filtered = all.filter(r => {
                const d = (r.date instanceof Date) ? r.date : new Date(r.date);
                const ymd = (dt) => dt.toISOString().slice(0,10);
                const dStr = ymd(d);
                if (start && dStr < start) return false;
                if (end && dStr > end) return false;
                return true;
            }).sort((a,b) => new Date(b.date) - new Date(a.date));

            total = filtered.length;
            const startIdx = (page - 1) * pageSize;
            rows = filtered.slice(startIdx, startIdx + pageSize);
        }

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        res.render('movements/index', {
            movements: rows,
            path: '/movements',
            filters: { start, end },
            pagination: { page, totalPages, total, pageSize }
        });
    } catch (err) {
        next(err);
    }
};

// FORMULARIO NUEVO
exports.newForm = async (req, res, next) => {
    try {
        const [categories] = await Cat.findAll();
        res.render('movements/form', {
            movement: {},
            categories,
            path: '/movements'
        });
    } catch (err) {
        next(err);
    }
};

// CREAR
exports.create = async (req, res, next) => {
    try {
        const attachment = req.file ? req.file.filename : null;
        const validTypes = ['gasto', 'ingreso'];
        const type       = validTypes.includes(req.body.type) ? req.body.type : 'gasto';

        await Mov.create({ ...req.body, type, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

// FORMULARIO EDITAR
exports.editForm = async (req, res, next) => {
    try {
        const [[movement]] = await Mov.findById(req.params.id);
        if (!movement) return res.redirect('/movements');

        const [categories] = await Cat.findAll();
        res.render('movements/form', {
            movement,
            categories,
            path: '/movements'
        });
    } catch (err) {
        next(err);
    }
};

// ACTUALIZAR
exports.update = async (req, res, next) => {
    try {
        let attachment = req.body.currentAttachment || null;
        if (req.file) {
            if (attachment) {
                try {
                    fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', attachment));
                } catch (_) { /* si no existe el archivo, ignorar */ }
            }
            attachment = req.file.filename;
        }

        const validTypes = ['gasto', 'ingreso'];
        const type       = validTypes.includes(req.body.type) ? req.body.type : 'gasto';

        await Mov.update(req.params.id, { ...req.body, type, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

// ELIMINAR
exports.delete = async (req, res, next) => {
    try {
        await Mov.delete(req.params.id);
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};
