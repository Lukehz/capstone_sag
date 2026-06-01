const express = require('express');
const router = express.Router();
const multer = require('multer');
const sectorController = require('../../controllers/AdminControllers/sectorControllers');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

// Leer es libre para cualquier usuario logueado (se usa en formularios y mapa)
router.get('/filter', requiereLogin, sectorController.getFilteredSector);
router.get('/', requiereLogin, sectorController.getSector);
router.get('/opciones', requiereLogin, sectorController.getOpcionesSector);
router.get('/:id', requiereLogin, sectorController.getSectorById);
// Gestionar catálogos maestros: solo quien tenga acción/eliminar en datos_maestros
router.post('/', requiereAccion('datos_maestros'), upload.none(), sectorController.createSector);
router.put('/:id', requiereAccion('datos_maestros'), upload.none(), sectorController.updateSector);
router.delete('/:id', requiereCapacidad('maestro.eliminar'), sectorController.deleteSector);

module.exports = router;