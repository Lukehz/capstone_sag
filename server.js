// Cargar variables de entorno desde el archivo .env (debe ser lo primero)
require('dotenv').config();

const http = require('http');
const app = require('./server/app'); // Instancia de la aplicación Express configurada en server/app.js
const { connectDB } = require('./server/config/db'); // Función de conexión a la base de datos

const PORT = process.env.PORT || 3000;

// Conectar a la base de datos y luego iniciar el servidor
connectDB()
    .then(() => {
        const server = http.createServer(app);
        server.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error('No se pudo iniciar el servidor debido a un error de conexión a la base de datos:', error.message);
    });
