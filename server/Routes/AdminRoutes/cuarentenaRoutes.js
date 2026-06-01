const express = require('express');
const router = express.Router();
const multer = require('multer');
const cuarentenaController = require('../../controllers/AdminControllers/cuarentenaControllers');
const { requiereVer, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

router.get('/filter', requiereVer('cuarentenas'), cuarentenaController.getFilteredCuarentenas);
router.get('/', requiereVer('cuarentenas'), cuarentenaController.getCuarentenas);
// Crear una cuarentena nace activa => requiere la capacidad de activar/desactivar
router.post('/', requiereCapacidad('cuarentena.activar_desactivar'), upload.none(), cuarentenaController.createCuarentena);
router.get('/:id', requiereVer('cuarentenas'), cuarentenaController.getCuarentenaById);
router.put('/:id', requiereAccion('cuarentenas'), upload.none(), cuarentenaController.updateCuarentena);
router.delete('/:id', requiereCapacidad('cuarentena.eliminar'), cuarentenaController.deleteCuarentena);

module.exports = router;