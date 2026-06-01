const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server

const getHistorial = async (req, res) => {
    const sqlQuery = `SELECT id, tabla, [ID Parcelacion], accion, fecha, coordenadas, sector, fase, cultivo, registrada
                        FROM VW_historial;`;
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Exportar las funciones
module.exports = {
    getHistorial
};