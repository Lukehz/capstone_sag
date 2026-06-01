const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server

/************************   
***** CUARENTENA ******
 *************************/
const getCuarentenas = async (req, res) => {
    const sqlQuery = 'SELECT id, sector, latitud, longitud, [radio(Metros)] , motivo, activa from vw_cuarentena ;';
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear un nuevo ítem
const createCuarentena = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { latitud, longitud, radio, id_sector, comentario, activa } = req.body;
    
    //Si llega como contenido 'null' o vacio lo trasforma en null
    const radioValue = (radio === 'null' || radio === '') ? null : Number(radio);

    console.log('fuera de la condicion', req.body);
    const sqlQuery = `
        INSERT INTO cuarentena (latitud, longitud, radio, id_sector, comentario, activa) 
        VALUES (@latitud, @longitud, @radio, @id_sector, @comentario, @activa)
    `;

    try {
        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'latitud', type: sql.Float, value: latitud },
            { name: 'longitud', type: sql.Float, value: longitud },
            { name: 'radio', type: sql.Int, value: radioValue },
            { name: 'id_sector', type: sql.Int, value: id_sector },
            { name: 'comentario', type: sql.VarChar, value: comentario },
            { name: 'activa', type: sql.Int, value: activa },
        ]);

        // Responder con el resultado de la inserción y código 201 (creado)
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer los datos de un ítem por ID para rellenar el formulario de edición
const getCuarentenaById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_cuarentena, latitud, longitud, radio, id_sector, comentario , activa
            FROM cuarentena 
            WHERE id_cuarentena = @id
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
const updateCuarentena = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const { latitud, longitud, radio, id_sector, comentario, activa } = req.body;

const radioValue = (radio === 'null' || radio === '') ? null : Number(radio);
    const sqlQuery = `
        UPDATE cuarentena 
        SET latitud = @latitud, 
            longitud = @longitud,
            radio = @radio,
            id_sector = @id_sector,
            comentario = @comentario,
            activa = @activa
        WHERE id_cuarentena = @id
    `;

    try {
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'latitud', type: sql.Float, value: latitud },
            { name: 'longitud', type: sql.Float, value: longitud },
            { name: 'radio', type: sql.Int, value: radioValue },
            { name: 'id_sector', type: sql.Int, value: id_sector },
            { name: 'comentario', type: sql.VarChar, value: comentario },
            { name: 'activa', type: sql.Int, value: activa },
            { name: 'id', type: sql.Int, value: id }
        ]);

        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
const deleteCuarentena = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const sqlQuery = 'DELETE FROM cuarentena WHERE id_cuarentena = @id'; 

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

const getFilteredCuarentenas = async (req, res) => {
    const { sectors, radio } = req.query;

    let sqlQuery = 'SELECT id, sector, latitud, longitud, [radio(Metros)], motivo FROM vw_cuarentena WHERE 1=1';
    const params = [];

    // Filtrar por sectores si se proporciona
    if (sectors) {
        const sectorArray = sectors.split(',').map(sector => sector.trim());
        sqlQuery += ` AND sector IN (${sectorArray.map((_, index) => `@sector${index}`).join(', ')})`;
        sectorArray.forEach((sector, index) => {
            params.push({ name: `sector${index}`, type: sql.VarChar, value: sector });
        });
    }

    // Filtrar por radio si se proporciona
    if (radio) {
        if (radio === 'Trazado') {
            sqlQuery += ` AND [radio(Metros)] = 'Trazado'`;
        } else if (radio === 'Valores') {
            sqlQuery += ` AND [radio(Metros)] != 'Trazado'`;
        }
    }

    // Agregar logs para depuración
    console.log('SQL Query:', sqlQuery);
    console.log('Parameters:', params);

    try {
        const result = await query(sqlQuery, params);
        res.json(result);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getCuarentenas,
    createCuarentena,
    getCuarentenaById,
    updateCuarentena,
    deleteCuarentena,
    getFilteredCuarentenas
};