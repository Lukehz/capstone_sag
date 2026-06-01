const express = require('express');
const router = express.Router();
const { requiereVer } = require('../../Middlewares/permisos');
const bitacora = require('../../controllers/AdminControllers/bitacoraController');

// Solo lectura: requiere VER el apartado 'bitacora'.
router.get('/resumen', requiereVer('bitacora'), bitacora.resumen); // KPIs + últimos (dashboard)
router.get('/', requiereVer('bitacora'), bitacora.listar);          // lista completa con filtros

module.exports = router;
