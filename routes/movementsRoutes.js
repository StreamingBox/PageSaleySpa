const express = require('express');
const router  = express.Router();
const mc      = require('../controllers/movementsController');
const multer  = require('multer');
const path    = require('path');

/* --- Configuración de multer --- */
const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'public', 'uploads'),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

/* --- Rutas --- */
router.get('/', mc.index);
router.get('/new', mc.newForm);
router.post('/new', upload.single('attachment'), mc.create);
router.get('/:id/edit', mc.editForm);

// Ruta principal de actualización (PUT)
router.put('/:id', upload.single('attachment'), mc.update);

// Compatibilidad por si el form envía POST
router.post('/:id', upload.single('attachment'), mc.update);
router.post('/:id/edit', upload.single('attachment'), mc.update);

router.delete('/:id', mc.delete);

module.exports = router;
