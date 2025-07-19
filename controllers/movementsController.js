const Mov  = require('../models/movementsModel');
const fs   = require('fs');
const path = require('path');

exports.index = async (req, res, next) => {
    try {
        const [rows] = await Mov.findAll();
        res.render('movements/index', { movements: rows });
    } catch (err) {
        next(err);
    }
};

exports.newForm = (req, res) => {
    res.render('movements/form', { movement: {} });
};

exports.create = async (req, res, next) => {
    try {
        const attachment = req.file ? req.file.filename : null;
        await Mov.create({ ...req.body, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

exports.editForm = async (req, res, next) => {
    try {
        const [[movement]] = await Mov.findById(req.params.id);
        res.render('movements/form', { movement });
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        let attachment = req.body.currentAttachment || null;
        if (req.file) {
            if (attachment) {
                fs.unlinkSync(path.join(__dirname, '..', 'public', 'uploads', attachment));
            }
            attachment = req.file.filename;
        }
        await Mov.update(req.params.id, { ...req.body, attachment });
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await Mov.delete(req.params.id);
        res.redirect('/movements');
    } catch (err) {
        next(err);
    }
};
