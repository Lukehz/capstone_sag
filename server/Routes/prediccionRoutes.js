const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/prediccionController.js');
const multer = require('multer');
const { requiereCapacidad } = require('../Middlewares/permisos');

const upload = multer({ dest: 'uploads/' });

// Ejecutar la predicción requiere la capacidad
router.post('/prediccion', requiereCapacidad('prediccion.ejecutar'), upload.single('image'), predictionController.handlePrediction);

module.exports = router;