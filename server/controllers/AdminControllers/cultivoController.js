const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server

/************************   
***** CULTIVO ******
 *************************/
const getCultivo = async (req, res) => {
    const sqlQuery = 'SELECT id_cultivo AS id, nombre FROM cultivo ;';
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  };

// Crear un nuevo ítem
const createCultivo = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { nombre } = req.body;

    const sqlQuery = `
        INSERT INTO cultivo (nombre) 
        VALUES (@nombre)
    `;

    try {
        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre }
        ]);

        // Responder con el resultado de la inserción y código 201 (creado)
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer los datos de un ítem por ID para rellenar el formulario de edición
const getCultivoById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_cultivo, nombre 
            FROM cultivo 
            WHERE id_cultivo = @id
        `;
        
        // Ejecutar la consulta pasando el ID como parámetro
        const result = await query(sqlQuery, [
            { name: 'id', type: sql.Int, value: id } // Convertir el ID a entero antes de pasarlo a la consulta
        ]);

        // Verificar si se encontró algún ítem
        if (result.length > 0) {
            // Si se encontró, devolver el primer ítem en formato JSON
            res.json(result[0]);
        } else {
            res.status(404).json({ error: 'Ítem no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener ítem:', error.message); // Registrar el error en la consola para depuración
        res.status(500).json({ error: error.message });
    }
};

// Actualizar un ítem
const updateCultivo = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const { nombre } = req.body;

    const sqlQuery = `
        UPDATE cultivo 
        SET nombre = @nombre
        WHERE id_cultivo = @id
    `;

    try {
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'id', type: sql.Int, value: id }
        ]);

        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
const deleteCultivo = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const sqlQuery = 'DELETE FROM cultivo WHERE id_cultivo = @id'; 

    try {
        // Ejecutar la consulta de eliminación con el ID proporcionado
        await query(sqlQuery, [
            { name: 'id', type: sql.Int, value: id } // Parámetro para la consulta
        ]);
        res.sendStatus(204); // Responder con código 204 (sin contenido) si la eliminación fue exitosa
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getCultivo,
    createCultivo,
    getCultivoById,
    updateCultivo,
    deleteCultivo
};