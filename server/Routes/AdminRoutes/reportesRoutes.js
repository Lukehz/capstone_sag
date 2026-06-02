const express = require('express');
const router = express.Router();
const { requiereVerAlguno } = require('../../Middlewares/permisos');
const reportes = require('../../controllers/AdminControllers/reportesController');

// Datos para exportar (Excel). Requiere poder VER parcelaciones o cuarentenas.
router.get('/datos', requiereVerAlguno(['parcelaciones', 'cuarentenas']), reportes.datosExport);

module.exports = router;
