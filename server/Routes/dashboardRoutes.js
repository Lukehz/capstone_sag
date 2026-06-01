const express = require('express');
const router = express.Router();
const { requiereVer } = require('../Middlewares/permisos');
const { resumen, usuarios } = require('../controllers/dashboardController');

// Resumen general: cualquier rol con acceso al dashboard.
router.get('/resumen', requiereVer('dashboard'), resumen);

// Estadísticas de usuarios: SOLO administrador (único rol con 'usuarios').
router.get('/usuarios', requiereVer('usuarios'), usuarios);

module.exports = router;
