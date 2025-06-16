// routes/salesRoutes.js
const express = require('express');
const router  = express.Router();

const { isAuth }       = require('../middleware/auth');
const salesController  = require('../controllers/salesController');

/* LISTADO */
/* GET /sales */
router.get('/',              isAuth, salesController.list);

/* NUEVA VENTA */
/* GET  /sales/new  – formulario */
router.get('/new',           isAuth, salesController.showNew);
/* POST /sales/new  – guardar */
router.post('/new',          isAuth, salesController.create);

/* EDITAR VENTA */
/* GET  /sales/:id/edit  – formulario */
router.get('/:id/edit',      isAuth, salesController.showEdit);
/* POST /sales/:id/edit – actualizar */
router.post('/:id/edit',     isAuth, salesController.update);

module.exports = router;
