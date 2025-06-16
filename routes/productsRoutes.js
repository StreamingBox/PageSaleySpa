const express = require('express');
const router  = express.Router();
const productsController = require('../controllers/productsController');

// Montado con app.use('/products', productsRoutes)

router.get('/',            productsController.list);
router.get('/new',         productsController.showNew);
router.post('/new',        productsController.create);
router.get('/:hash/edit',  productsController.showEdit);
router.post('/:hash/edit', productsController.update);

module.exports = router;
