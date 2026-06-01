const { sql, query } = require('../../config/db'); // Importa la función para conectar a la base de datos

/************************   
***** REGION ******
 *************************/
// Leer todas las regiones
exports.getRegion = async (req, res) => {
    const sqlQuery = 'SELECT id_region AS id, numero, nombre FROM region';
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear una nueva región
exports.createRegion = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { nombre, numero } = req.body;
    console.log('ESTO SON LO DATOS RECIBIDOS: ', req.body);
    const sqlQuery = `
        INSERT INTO region (nombre, numero) 
        VALUES (@nombre, @numero)
    `;

    try {
        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'numero', type: sql.VarChar, value: numero }
        ]);

        // Responder con el resultado de la inserción y código 201 (creado)
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer datos de una región por ID
exports.getRegionById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_region, nombre, numero 
            FROM region 
            WHERE id_region = @id
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

// Actualizar una región
exports.updateRegion = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    // Debes usar `req.body` de manera adecuada
    const nombre = req.body.nombre; // Verifica que este valor no sea undefined
    const numero = req.body.numero; // Verifica que este valor no sea undefined

    console.log('Recibiendo id:', id);
    console.log('Recibiendo nombre:', nombre);
    console.log('Recibiendo numero:', numero);

    const sqlQuery = `
        UPDATE region 
        SET nombre = @nombre, 
            numero = @numero
        WHERE id_region = @id
    `;

    try {
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'numero', type: sql.VarChar, value: numero },
            { name: 'id', type: sql.Int, value: id }
        ]);

        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
exports.deleteRegion = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const sqlQuery = 'DELETE FROM region WHERE id_region = @id'; 

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