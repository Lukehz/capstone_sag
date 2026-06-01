const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server

/************************   
***** PROVINCIA ******
 *************************/
const getProvincia = async (req, res) => {
    const sqlQuery = 'SELECT id, region, provincia FROM vw_provincia';
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  };

// Crear un nuevo ítem
const createProvincia = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { id_region, nombre } = req.body;

    const sqlQuery = `
        INSERT INTO provincia (nombre, id_region) 
        VALUES (@nombre, @id_region)
    `;

    try {
        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'id_region', type: sql.Int, value: id_region }
        ]);

        // Responder con el resultado de la inserción y código 201 (creado)
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer los datos de un ítem por ID para rellenar el formulario de edición
const getProvinciaById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_provincia, id_region, nombre 
            FROM provincia 
            WHERE id_provincia = @id
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
const updateProvincia = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    // Debes usar `req.body` de manera adecuada
    const id_region = req.body.id_region; // Verifica que este valor no sea undefined
    const nombre = req.body.nombre; // Verifica que este valor no sea undefined

    console.log('Recibiendo id:', id);
    console.log('Recibiendo id_region:', id_region);
    console.log('Recibiendo nombre:', nombre);

    const sqlQuery = `
        UPDATE provincia 
        SET nombre = @nombre, 
            id_region = @id_region
        WHERE id_provincia = @id
    `;

    try {
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'id_region', type: sql.Int, value: id_region },
            { name: 'id', type: sql.Int, value: id }
        ]);

        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
const deleteProvincia = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const sqlQuery = 'DELETE FROM provincia WHERE id_provincia = @id'; 

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

const getFilteredProvincia = async (req, res) => {
    const { regiones } = req.query; // Obtiene los nombres de las regiones desde la consulta
    console.log(regiones);
    let sqlQuery = 'SELECT id, region, provincia FROM vw_provincia WHERE 1=1';
    const params = [];

    // Agregar filtro si regiones está presente
    if (regiones) {
        const nameArray = regiones.split(',').map(name => name.trim());
        sqlQuery += ` AND region IN (${nameArray.map((_, index) => `@regionName${index}`).join(', ')})`;
        nameArray.forEach((name, index) => {
            params.push({ name: `regionName${index}`, type: sql.VarChar, value: name });
        });
    }

    // Agregar logs para depuración
    console.log('SQL Query:', sqlQuery);
    console.log('Parameters:', params);

    try {
        const result = await query(sqlQuery, params); // Ejecuta la consulta
        res.json(result); // Devuelve el resultado
    } catch (error) {
        console.error('Error executing query:', error); // Log del error
        res.status(500).json({ error: error.message }); // Manejo de errores
    }
};

module.exports = {
    getProvincia,
    createProvincia,
    getProvinciaById,
    updateProvincia,
    deleteProvincia,
    getFilteredProvincia
};