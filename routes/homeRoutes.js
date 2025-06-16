// routes/homeRoutes.js
const express = require('express');
const router  = express.Router();
const home    = require('../controllers/homeController');

// Si tienes un middleware de autenticación, colócalo aquí.
// Ejemplo:  const { isAuth } = require('../middleware/auth');

// Dashboard con rango de fechas opcional
router.get('/', /* isAuth, */ home.dashboard);

// Exportar a Excel el mismo rango de fechas
// se invoca como /export?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/export', /* isAuth, */ home.exportExcel);

module.exports = router;
