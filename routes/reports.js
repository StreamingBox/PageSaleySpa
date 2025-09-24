const express = require('express');
const router  = express.Router();
const rc      = require('../controllers/reportsController');

router.get('/overview', rc.overview);

module.exports = router;
