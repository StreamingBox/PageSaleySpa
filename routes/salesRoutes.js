const express = require('express');
const router  = express.Router();
const sales   = require('../controllers/salesController');

// LISTAR  /sales
router.get('/',          sales.list);
// NUEVA   /sales/new
router.get('/new',       sales.showNew);
router.post('/new',      sales.create);

// ⬇⬇ NUEVAS RUTAS DE EDICIÓN ⬇⬇
router.get('/:id/edit',  sales.showEdit);
router.post('/:id/edit', sales.update);

module.exports = router;
