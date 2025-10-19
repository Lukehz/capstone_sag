const sql = require('mssql');
/*
// Configuración de conexión
// BASE DE DATOS DESARROLLO (Desabilitada)

const config = {
    user: 'Luc_hernandez_SQLLogin_1',
    password: 'nus1f946z7',
    server: 'ProyectoCapstone.mssql.somee.com',
    database: 'ProyectoCapstone',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};
*/
// Configuración de conexión
// BASE DE DATOS PRODUCTIVA (Consultar a lucas para su habilitacion)
const config = {
    user: 'luchernandez',
    password: 'Capstone-sag',
    server: 'capstone-sag.database.windows.net',
    database: 'capstone-sag',
    options: {
        encrypt: true,
        trustServerCertificate: true
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
