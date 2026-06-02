const express = require('express');
const router = express.Router();
const { requiereVer } = require('../Middlewares/permisos');
const { resumen, usuarios, parcelasRaw } = require('../controllers/dashboardController');

// Resumen general: cualquier rol con acceso al dashboard.
router.get('/resumen', requiereVer('dashboard'), resumen);

// Datos por parcela para los gráficos interactivos del panel.
router.get('/parcelas-raw', requiereVer('dashboard'), parcelasRaw);

// Estadísticas de usuarios: SOLO administrador (único rol con 'usuarios').
router.get('/usuarios', requiereVer('usuarios'), usuarios);

module.exports = router;