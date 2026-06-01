const express = require('express');
const router = express.Router();
const multer = require('multer');
const cultivoController = require('../../controllers/AdminControllers/cultivoController');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/', requiereLogin, cultivoController.getCultivo);
router.get('/:id', requiereLogin, cultivoController.getCultivoById);
router.post('/', requiereAccion('datos_maestros'), upload.none(), cultivoController.createCultivo);
router.put('/:id', requiereAccion('datos_maestros'), upload.none(), cultivoController.updateCultivo);
router.delete('/:id', requiereCapacidad('maestro.eliminar'), cultivoController.deleteCultivo);

module.exports = router;