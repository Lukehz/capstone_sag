require('dotenv').config();
const sql = require('mssql');

// Configuración de conexión leída desde variables de entorno (.env)
// Las credenciales NO deben quedar escritas en el código fuente.
const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
        trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true'
    }
};

let pool; // Variable para la conexión de pool

// Función para conectar a la base de datos
const connectDB = async () => {
    if (!pool) { // Solo crear un pool si no existe
        try {
            pool = await sql.connect(config);
            console.log('Conexión exitosa a SQL Server');
        } catch (error) {
            console.error('Error al conectar a SQL Server:', error.message);
            throw error; // Lanza el error para manejarlo donde se llame
        }
    }
};

// Función para realizar consultas
const query = async (sqlQuery, params = []) => {
    try {
        await connectDB(); // Asegúrate de estar conectado antes de hacer la consulta
        const request = pool.request(); // Usa el pool para crear la solicitud

        // Agregar parámetros si los hay
        params.forEach(param => {
            request.input(param.name, param.type, param.value);
        });

        const result = await request.query(sqlQuery);
        return result.recordset; // Devuelve los resultados de la consulta
    } catch (error) {
        console.error('Error en la consulta SQL:', error.message);
        throw error; // Lanza el error para que sea manejado en el endpoint
    }
};

// Cerrar la conexión adecuadamente
const closeConnection = async () => {
    if (pool) {
        await sql.close();
        pool = null; // Restablece el pool a null
        console.log('Conexión cerrada con SQL Server');
    }
};

// Manejar la señal de salida
process.on('SIGINT', async () => {
    await closeConnection();
    process.exit();
});

// Exportar la conexión y función
module.exports = {
    connectDB,
    sql,
    query // Asegúrate de exportar la función query también
};
