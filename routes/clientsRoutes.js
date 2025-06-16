// routes/clientsRoutes.js
const express = require('express');
const router  = express.Router();
const clientsController = require('../controllers/clientsController');

// Montado en app.js con:
//    app.use('/clients', clientsRoutes)

// 1) Listar clientes
router.get('/', clientsController.list);

// 2) Formulario para nuevo cliente
router.get('/new', clientsController.showNew);

// 3) Procesar creación
router.post('/new', clientsController.create);

// 4) Formulario para editar cliente (por hash)
router.get('/:hash/edit', clientsController.showEdit);

// 5) Procesar actualización
router.post('/:hash/edit', clientsController.update);

module.exports = router;
