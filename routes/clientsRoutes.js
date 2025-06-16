// routes/clientsRoutes.js
const express = require('express');
const router  = express.Router();
const { isAuth }         = require('../middleware/auth');
const clientsController  = require('../controllers/clientsController');

router.get('/',            isAuth, clientsController.list);
router.get('/new',         isAuth, clientsController.showNew);
router.post('/new',        isAuth, clientsController.create);
router.get('/:hash/edit',  isAuth, clientsController.showEdit);
router.post('/:hash/edit', isAuth, clientsController.update);

module.exports = router;
