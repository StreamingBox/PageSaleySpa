// routes/homeRoutes.js
const router = require('express').Router();
const home   = require('../controllers/homeController');
const { isAuth } = require('../middleware/auth');

router.get('/',       isAuth, home.dashboard);
router.get('/export', isAuth, home.exportExcel);

module.exports = router;
