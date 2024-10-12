const express = require('express');
const cors = require('cors');
const path = require('path');
const parcelasRoutes = require('./routes/parcelasRoutes');
const quarantineRoutes = require('./routes/quarantineRoutes');



const app = express();

// Configuración de CORS
app.use(cors());
app.use(express.json());

// Configuración para servir archivos estáticos
app.use(express.static(path.join(__dirname, '../../public')));

// Rutas
app.use('/api', parcelasRoutes);
app.use('/parcelas', parcelasRoutes);
app.use('/api', quarantineRoutes);
app.use('/quarantines', quarantineRoutes);
app.use('/quarantine', quarantineRoutes);


// Middleware para manejar errores
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Ha ocurrido un error en el servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// Manejo de ruta no encontrada (paraz cualquier ruta no especificada)
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Usar el middleware de manejo de errores
app.use(errorHandler);

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  process.exit(1);
});

module.exports = app; // Exporta la aplicación