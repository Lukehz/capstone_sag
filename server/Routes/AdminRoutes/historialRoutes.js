const express = require('express');
const router = express.Router();
const historialController = require('../../controllers/AdminControllers/historialController');
const { requiereVer } = require('../../Middlewares/permisos');

router.get('/', requiereVer('historial'), historialController.getHistorial);

module.exports = router;