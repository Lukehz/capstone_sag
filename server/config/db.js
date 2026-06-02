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
    },
    // Pool de conexiones reutilizables (evita reconectar en cada consulta)
    pool: {
        max: 10,                 // máximo de conexiones simultáneas reutilizables
        min: 0,                  // mínimo en reposo
        idleTimeoutMillis: 30000 // cierra conexiones inactivas tras 30 s
    }
};

let pool;        // Pool ya conectado (se reutiliza en toda la app)
let poolPromise; // Conexión en curso (evita conectar dos veces a la vez)

// Función para conectar a la base de datos (idempotente y a prueba de concurrencia)
const connectDB = async () => {
    if (pool) return pool;            // Ya conectado -> reutiliza
    if (!poolPromise) {               // Nadie está conectando aún -> inicia UNA sola conexión
        poolPromise = sql.connect(config)
            .then((p) => {
                pool = p;
                console.log('Conexión exitosa a SQL Server');
                return p;
            })
            .catch((error) => {
                poolPromise = null;   // Permite reintentar si la conexión falló
                console.error('Error al conectar a SQL Server:', error.message);
                throw error;
            });
    }
    return poolPromise;               // Quienes lleguen mientras tanto esperan la misma conexión
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
        pool = null;
        poolPromise = null; // Restablece para permitir reconectar
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