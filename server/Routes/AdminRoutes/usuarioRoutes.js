const express = require('express');
const router = express.Router();
const multer = require('multer');
const usuarioController = require('../../controllers/AdminControllers/usuarioController');
const { requiereLogin, requiereVer, requiereAccion, requiereCapacidad } = require('../../Middlewares/permisos');

const upload = multer();

// Preferencia de tema: cualquier usuario logueado actualiza la suya (antes de /:id)
router.put('/tema', requiereLogin, upload.none(), usuarioController.updateTema);

// Gestión de usuarios: solo el apartado 'usuarios'
router.get('/filter', requiereVer('usuarios'), usuarioController.getFilteredUsuario);
router.get('/', requiereVer('usuarios'), usuarioController.getUsuario);
router.post('/', requiereAccion('usuarios'), upload.none(), usuarioController.createUsuario);
router.get('/:id', requiereVer('usuarios'), usuarioController.getUsuarioById);
router.put('/:id', requiereAccion('usuarios'), upload.none(), usuarioController.updateUsuario);
router.delete('/:id', requiereCapacidad('usuario.eliminar'), usuarioController.deleteUsuario);

module.exports = router;