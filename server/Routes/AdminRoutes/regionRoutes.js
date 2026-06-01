const express = require('express');
const router = express.Router();
const multer = require('multer');
const regionController = require('../../controllers/AdminControllers/regionControllers');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/', requiereLogin, regionController.getRegion);
router.get('/:id', requiereLogin, regionController.getRegionById);
router.post('/', requiereAccion('datos_maestros'), upload.none(), regionController.createRegion);
router.put('/:id', requiereAccion('datos_maestros'), upload.none(), regionController.updateRegion);
router.delete('/:id', requiereCapacidad('maestro.eliminar'), regionController.deleteRegion);

module.exports = router;