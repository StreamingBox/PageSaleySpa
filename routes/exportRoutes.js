const express = require('express');
const { requireRoles } = require('../middleware/auth');
const { exportExcel } = require('../controllers/homeController');

const router = express.Router();

router.get('/export', requireRoles('admin'), exportExcel);

module.exports = router;
