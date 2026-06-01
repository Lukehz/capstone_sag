const express = require('express');
const router = express.Router();
const multer = require('multer');
const provinciaController = require('../../controllers/AdminControllers/provinciaControllers');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/filter', requiereLogin, provinciaController.getFilteredProvincia);
router.get('/', requiereLogin, provinciaController.getProvincia);
router.get('/:id', requiereLogin, provinciaController.getProvinciaById);
router.post('/', requiereAccion('datos_maestros'), upload.none(), provinciaController.createProvincia);
router.put('/:id', requiereAccion('datos_maestros'), upload.none(), provinciaController.updateProvincia);
router.delete('/:id', requiereCapacidad('maestro.eliminar'), provinciaController.deleteProvincia);

module.exports = router;