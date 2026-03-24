const express = require('express');
const { isAuth } = require('../middleware/auth');
const { exportExcel } = require('../controllers/homeController');

const router = express.Router();

router.get('/export', isAuth, exportExcel);

module.exports = router;
