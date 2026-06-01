const express = require('express');
const router = express.Router();
const { requiereVer, requiereVerAlguno, requiereAccion } = require('../../Middlewares/permisos');
const rol = require('../../controllers/AdminControllers/rolController');

// Lectura: requiere VER el apartado 'roles'
router.get('/catalogos', requiereVer('roles'), rol.catalogos);
// Opciones para poblar selects (lo usa también el formulario de Usuarios)
router.get('/opciones', requiereVerAlguno(['usuarios', 'roles']), rol.opciones);
router.get('/', requiereVer('roles'), rol.listar);
router.get('/:id', requiereVer('roles'), rol.obtener);

// Modificación: requiere ACCIÓN sobre el apartado 'roles'
router.post('/', requiereAccion('roles'), rol.crear);
router.put('/:id', requiereAccion('roles'), rol.actualizar);
router.delete('/:id', requiereAccion('roles'), rol.eliminar);

module.exports = router;