const express = require('express');
const router = express.Router();
const multer = require('multer');
const parcelacionController = require('../../controllers/AdminControllers/parcelacionController');
const { requiereVer, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/filter', requiereVer('parcelaciones'), parcelacionController.getFilteredParcelaciones);
router.get('/', requiereVer('parcelaciones'), parcelacionController.getParcelaciones);
router.post('/', requiereAccion('parcelaciones'), upload.single('image'), parcelacionController.createParcelacion);
router.get('/get-image', requiereVer('parcelaciones'), parcelacionController.getImage);
router.get('/opciones', requiereVer('parcelaciones'), parcelacionController.getOpciones);
router.get('/:id', requiereVer('parcelaciones'), parcelacionController.getParcelacionById);
router.put('/:id', requiereAccion('parcelaciones'), upload.single('image'), parcelacionController.updateParcelacion);
router.delete('/:id', requiereCapacidad('parcelacion.eliminar'), parcelacionController.deleteParcelacion);

module.exports = router;