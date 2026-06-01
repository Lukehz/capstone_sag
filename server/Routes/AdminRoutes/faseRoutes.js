const express = require('express');
const router = express.Router();
const multer = require('multer');
const faseController = require('../../controllers/AdminControllers/faseController');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/', requiereLogin, faseController.getFase);
router.get('/:id', requiereLogin, faseController.getFaseById);
router.post('/', requiereAccion('datos_maestros'), upload.none(), faseController.createFase);
router.put('/:id', requiereAccion('datos_maestros'), upload.none(), faseController.updateFase);
router.delete('/:id', requiereCapacidad('maestro.eliminar'), faseController.deleteFase);

module.exports = router;