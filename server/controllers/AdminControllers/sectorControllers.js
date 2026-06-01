const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server

/************************   
***** SECTOR ******
 *************************/
const getSector = async (req, res) => {
    const sqlQuery = 'SELECT id, provincia, comuna FROM vw_sector_completo';
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  };

// Crear un nuevo ítem
const createSector = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { id_provincia, comuna } = req.body;

    const sqlQuery = `
        INSERT INTO sector (comuna, id_provincia) 
        VALUES (@comuna, @id_provincia)
    `;

    try {
        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'comuna', type: sql.VarChar, value: comuna },
            { name: 'id_provincia', type: sql.Int, value: id_provincia }
        ]);

        // Responder con el resultado de la inserción y código 201 (creado)
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer los datos de un ítem por ID para rellenar el formulario de edición
const getSectorById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_sector, id_provincia, comuna 
            FROM sector 
            WHERE id_sector = @id
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
const updateSector = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    // Debes usar `req.body` de manera adecuada
    const id_provincia = req.body.id_provincia; // Verifica que este valor no sea undefined
    const comuna = req.body.comuna; // Verifica que este valor no sea undefined

    const sqlQuery = `
        UPDATE sector 
        SET comuna = @comuna, 
            id_provincia = @id_provincia
        WHERE id_sector = @id
    `;

    try {
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'comuna', type: sql.VarChar, value: comuna },
            { name: 'id_provincia', type: sql.Int, value: id_provincia },
            { name: 'id', type: sql.Int, value: id }
        ]);

        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
const deleteSector = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const sqlQuery = 'DELETE FROM sector WHERE id_sector = @id'; 

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

// Opciones para los campo provincia(Contien region y provincia) en EL FOMULARIO DE SECTOR
const getOpcionesSector = async (req, res) => {
    console.log('Parámetros recibidos:', req.params); // Esto debería estar vacío
    console.log('Query:', req.query); // Esto debería estar vacío
    console.log('Body:', req.body); // Esto también debería estar vacío
    try {
        // Consulta para obtener las fases
        const sqlQuery = 'SELECT id_provincia, provincia FROM VW_listado_region_provincia;';

        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        // Captura cualquier error que ocurra en el bloque try
        console.error('Error al obtener opciones:', error);
        return res.status(500).json({ message: 'Error al obtener opciones', error: error.message });
    }
};

const getFilteredSector = async (req, res) => {
    const { provincias } = req.query; // Obtiene los nombres de las provincias desde la consulta

    let sqlQuery = 'SELECT id, provincia, comuna FROM vw_sector_completo WHERE 1=1';
    const params = [];

    // Filtrar por provincias si se proporciona
    if (provincias) {
        const provinciaArray = provincias.split(';').map(prov => prov.trim()); // Usa el punto y coma como delimitador
        sqlQuery += ` AND provincia IN (${provinciaArray.map((_, index) => `@provincia${index}`).join(', ')})`;
        provinciaArray.forEach((prov, index) => {
            params.push({ name: `provincia${index}`, type: sql.VarChar, value: prov });
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
    getSector,
    createSector,
    getSectorById,
    updateSector,
    deleteSector,
    getOpcionesSector,
    getFilteredSector
};