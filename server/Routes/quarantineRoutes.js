const express = require('express');
const router = express.Router();
const { getComentario, saveQuarantine, getAllQuarantines,
        getAllRadiusQuarantines, getComuna, deactivateQuarantine,
        getInactiveQuarantines, getInactivaTrazado,
        activateQuarantine, getComentarioInactiva, getComunaInactiva} = require('../controllers/quarantineController');
const { requiereLogin, requiereCapacidad } = require('../Middlewares/permisos');

// Crear/activar/desactivar una cuarentena => requiere la capacidad
router.post('/save-quarantine', requiereCapacidad('cuarentena.activar_desactivar'), saveQuarantine);
router.put('/deactivate-quarantine/:id', requiereCapacidad('cuarentena.activar_desactivar'), deactivateQuarantine);
router.put('/activa/:id', requiereCapacidad('cuarentena.activar_desactivar'), activateQuarantine);

// Lectura de capas del mapa: cualquier usuario logueado
router.get('/get-all-quarantines', requiereLogin, getAllQuarantines);
router.get('/get-comentario', requiereLogin, getComentario);
router.get('/radius', requiereLogin, getAllRadiusQuarantines);
router.get('/comuna', requiereLogin, getComuna);
router.get('/inactiva', requiereLogin, getInactiveQuarantines);
router.get('/inactiva-trazado', requiereLogin, getInactivaTrazado);
router.get('/inactiva/comentario', requiereLogin, getComentarioInactiva);
router.get('/inactiva-comuna', requiereLogin, getComunaInactiva);

module.exports = router;