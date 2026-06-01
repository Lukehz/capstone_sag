const express = require('express');
const router = express.Router();
const { getParcelas, deleteParcela, getComuna, getParcelDataOptions, SaveParcel } = require('../controllers/parcelasController');
const { requiereLogin, requiereAccion, requiereCapacidad } = require('../Middlewares/permisos');

// Lectura para el mapa / opciones: cualquier usuario logueado
router.get('/get-comuna/parcelas', requiereLogin, getComuna);
router.get('/', requiereLogin, getParcelas);
router.get('/api/DataOptions', requiereLogin, getParcelDataOptions);
// Crear parcela en el mapa => acción en parcelaciones; eliminar => capacidad
router.post('/api/SaveParcel', requiereAccion('parcelaciones'), SaveParcel);
router.delete('/delete-parcela/:id', requiereCapacidad('parcelacion.eliminar'), deleteParcela);

module.exports = router;