// routes/homeRoutes.js
const express        = require('express');
const router         = express.Router();
const { isAuth }     = require('../middleware/auth');
const homeController = require('../controllers/homeController');

router.get('/',       isAuth, homeController.dashboard);
router.get('/export', isAuth, homeController.exportExcel);

module.exports = router;
