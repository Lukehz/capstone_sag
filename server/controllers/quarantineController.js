const { connectDB, sql, query } = require('../config/db');

const saveQuarantine = async (req, res) => {
  const { points, comment: comentario, type, radius, idSector } = req.body;
  if (!comentario || typeof comentario !== 'string' || comentario.trim() === '') {
    return res.status(400).json({ success: false, error: 'El campo "comentario" es obligatorio y debe ser una cadena válida.' });
  }

  let pool;
  let transaction;
  let idCuarentena;

  try {
    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    let latitud, longitud, radio = null;

    if (type === 'polygon') {
      if (points.length < 3) {
        return res.status(400).json({ success: false, error: 'Se requieren al menos 3 puntos para un trazado.' });
      }
      latitud = points[0][1];
      longitud = points[0][0];
    } else if (type === 'radius') {
      if (!points[0] || points[0].length !== 2 || !radius || isNaN(radius)) {
        return res.status(400).json({ success: false, error: 'Se requiere un punto central y un radio válido para una cuarentena por radio.' });
      }
      latitud = points[0][1];
      longitud = points[0][0];
      radio = parseFloat(radius);
      if (radio <= 0) {
        return res.status(400).json({ success: false, error: 'El radio debe ser un valor positivo.' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'El campo "type" debe ser "polygon" o "radius".' });
    }

    const activa = 1;

    // Paso 1: Guardar la cuarentena con id_sector (comuna seleccionada)
    const resultCuarentena = await transaction.request()
      .input('latitud', sql.Float, latitud)
      .input('longitud', sql.Float, longitud)
      .input('radio', sql.Float, radio)
      .input('id_sector', sql.Int, idSector)
      .input('comentario', sql.NVarChar, comentario)
      .input('activa', sql.Bit, activa)
      .query(`
        INSERT INTO dbo.cuarentena (latitud, longitud, radio, id_sector, comentario, activa)
        OUTPUT INSERTED.id_cuarentena
        VALUES (@latitud, @longitud, @radio, @id_sector, @comentario, @activa)
      `);

    idCuarentena = resultCuarentena.recordset[0].id_cuarentena;
    //console.log(`Cuarentena guardada con ID: ${idCuarentena}`);

    // Paso 2: Filtrar puntos duplicados (eliminar coordenadas repetidas)
    const uniquePoints = points.filter((value, index, self) =>
      index === self.findIndex((t) => (
        t[0] === value[0] && t[1] === value[1]
      ))
    );

    // Paso 3: Guardar los vértices solo si es un trazado
    if (type === 'polygon') {
      for (let i = 0; i < uniquePoints.length; i++) {
        // Verificar si el vértice ya existe en la base de datos
        const existingVertice = await transaction.request()
          .input('latitud', sql.Float, uniquePoints[i][1])
          .input('longitud', sql.Float, uniquePoints[i][0])
          .input('id_cuarentena', sql.Int, idCuarentena)
          .query(`
            SELECT COUNT(*) AS count
            FROM dbo.vertice
            WHERE id_cuarentena = @id_cuarentena
              AND latitud = @latitud
              AND longitud = @longitud
          `);

        if (existingVertice.recordset[0].count === 0) {
          // Solo insertar si el punto no existe
          await transaction.request()
            .input('id_cuarentena', sql.Int, idCuarentena)
            .input('latitud', sql.Float, uniquePoints[i][1])
            .input('longitud', sql.Float, uniquePoints[i][0])
            .input('orden', sql.Int, i + 1)
            .query('INSERT INTO dbo.vertice (id_cuarentena, latitud, longitud, orden) VALUES (@id_cuarentena, @latitud, @longitud, @orden)');
        }
      }
      //console.log(`Vértices guardados para el trazado de cuarentena con ID: ${idCuarentena}`);
    }

    // Ejecutar el procedimiento almacenado
    await transaction.request()
      .input('id_cuarentena', sql.Int, idCuarentena)
      .execute('sp_CrearConexionesCuarentena');
    //console.log(`Procedimiento almacenado ejecutado para la cuarentena ID: ${idCuarentena}`);

    // Confirmar la transacción
    await transaction.commit();
    res.status(201).json({
      success: true,
      id_cuarentena: idCuarentena,
      message: 'Cuarentena guardada exitosamente con todos sus componentes'
    });

  } catch (error) {
    console.error('Error en el proceso de guardar cuarentena:', error);
    if (transaction) await transaction.rollback();

    let message = 'Error al procesar la cuarentena: ';
    if (idCuarentena) {
      message += `Cuarentena guardada con ID ${idCuarentena}, pero hubo un error en pasos posteriores. `;
    }
    message += error.message;

    res.status(500).json({
      success: false,
      error: message,
      id_cuarentena: idCuarentena
    });
  } finally {
    if (pool) await pool.close();
  }
};



const getAllQuarantines = async (req, res) => {
  try {
    const result = await sql.query(`
    SELECT c.id_cuarentena, c.latitud, c.longitud, c.radio, c.comentario, c.activa,
    v.id_conexion, v.latitud_INI, v.longitud_INI, v.latitud_END, v.longitud_END, v.ORDEN
    FROM dbo.cuarentena c
    INNER JOIN VW_conexiones_cuarentena v ON c.id_cuarentena = v.id_cuarentena
    WHERE c.activa = 1
    ORDER BY c.id_cuarentena, v.ORDEN
    `);

    const quarantines = result.recordset.reduce((acc, row) => {
      if (!acc[row.id_cuarentena]) {
        acc[row.id_cuarentena] = {
          id: row.id_cuarentena,
          latitud: row.latitud,
          longitud: row.longitud,
          radio: row.radio,
          comentario: row.comentario,
          activa: row.activa,
          conexiones: [] // Cambié a conexiones
        };
      }
    
      acc[row.id_cuarentena].conexiones.push({
        id_conexion: row.id_conexion,
        latitud_INI: row.latitud_INI,
        longitud_INI: row.longitud_INI,
        latitud_END: row.latitud_END,
        longitud_END: row.longitud_END,
        orden: row.ORDEN,
      });
      return acc;
    }, {});

    res.json(Object.values(quarantines));
  } catch (error) {
    console.error('Error al obtener cuarentenas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllRadiusQuarantines = async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT id_cuarentena, latitud, longitud, radio, comentario, activa
      FROM dbo.cuarentena
      WHERE radio IS NOT NULL
      ORDER BY id_cuarentena
    `);

    const radiusQuarantines = result.recordset.map(row => ({
      id: row.id_cuarentena,
      latitud: row.latitud,
      longitud: row.longitud,
      radio: row.radio,
      comentario: row.comentario,
      activa: row.activa
    }));

    res.json(radiusQuarantines);
  } catch (error) {
    console.error('Error al obtener cuarentenas de radio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};



let isDeleting = false; // Flag para evitar duplicación de la acción


    
    
const getComentario = async (req, res) => {
  //console.log('Obteniendo comentarios');
  
  try {
    // Ejecutar la consulta
    const result = await sql.query(`
      SELECT DISTINCT c.id_cuarentena, 
                      c.latitud, 
                      c.longitud, 
                      c.radio, 
                      c.comentario, 
                      c.activa,
                      s.id_sector, 
                      s.comuna  -- Incluye la comuna
      FROM dbo.cuarentena c
      LEFT JOIN sector s ON c.id_sector = s.id_sector
      WHERE c.activa = 1
      ORDER BY c.id_cuarentena
    `);

    // Devolver los resultados como JSON
    res.json(result.recordset);
  } catch (err) {
    console.error('Error al obtener comentarios:', err);
    res.status(500).json({ error: 'Error al obtener información: ' + err.message });
  }
};

const getComuna = async (req, res) => {
  //console.log('Obteniendo comunas');
  
  try {
    // Ejecutar la consulta SQL directamente con sql.query
    const result = await sql.query(`
      SELECT id_sector, comuna
      FROM sector
      ORDER BY comuna
    `);

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        comunas: result.recordset // Enviar las comunas como `recordset`
      });
    } else {
      res.json({
        success: false,
        error: 'No se encontraron comunas'
      });
    }
  } catch (error) {
    console.error('Error al obtener comunas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las comunas'
    });
  }
};

const getComentarioInactiva = async (req, res) => {
  //console.log('Obteniendo comentarios');
  
  try {
    // Ejecutar la consulta
    const result = await sql.query(`
      SELECT DISTINCT c.id_cuarentena, 
                      c.latitud, 
                      c.longitud, 
                      c.radio, 
                      c.comentario, 
                      c.activa,
                      s.id_sector, 
                      s.comuna  -- Incluye la comuna
      FROM dbo.cuarentena c
      LEFT JOIN sector s ON c.id_sector = s.id_sector
      WHERE c.activa = 0
      ORDER BY c.id_cuarentena
    `);

    // Devolver los resultados como JSON
    res.json(result.recordset);
  } catch (err) {
    console.error('Error al obtener comentarios:', err);
    res.status(500).json({ error: 'Error al obtener información: ' + err.message });
  }
};

const getComunaInactiva = async (req, res) => {
  //console.log('Obteniendo comunas');
  
  try {
    // Ejecutar la consulta SQL directamente con sql.query
    const result = await sql.query(`
      SELECT id_sector, comuna
      FROM sector
      WHERE activa = 0
      ORDER BY comuna
    `);

    if (result.recordset.length > 0) {
      res.json({
        success: true,
        comunas: result.recordset // Enviar las comunas como `recordset`
      });
    } else {
      res.json({
        success: false,
        error: 'No se encontraron comunas'
      });
    }
  } catch (error) {
    console.error('Error al obtener comunas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener las comunas'
    });
  }
};



const getInactiveQuarantines = async (req, res) => {
  //console.log('Obteniendo cuarentenas inactivas');

  try {
    // Realizar la consulta correctamente
    const result = await sql.query(`
      SELECT id_cuarentena, latitud, longitud, radio, id_sector, comentario, activa
      FROM dbo.cuarentena
      WHERE activa = 0
    `);

    // Verificar el resultado de la consulta
    //console.log('Resultado de la consulta:', result.recordset);

    // Si no hay resultados, podemos devolver un mensaje más claro
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'No se encontraron cuarentenas inactivas.' });
    }

    // Responder con los resultados
    res.json(result.recordset);
  } catch (err) {
    console.error('Error al obtener inactivas:', err);
    res.status(500).json({ error: 'Error al obtener información: ' + err.message });
  }
};




const getInactivaTrazado = async (req, res) => {
  try {
    const result = await sql.query(`
    SELECT c.id_cuarentena, c.latitud, c.longitud, c.radio, c.comentario, c.activa,
    v.id_conexion, v.latitud_INI, v.longitud_INI, v.latitud_END, v.longitud_END, v.ORDEN
    FROM dbo.cuarentena c
    INNER JOIN VW_conexiones_cuarentena v ON c.id_cuarentena = v.id_cuarentena
    WHERE c.activa = 0
    ORDER BY c.id_cuarentena, v.ORDEN
    `);

    const quarantines = result.recordset.reduce((acc, row) => {
      if (!acc[row.id_cuarentena]) {
        acc[row.id_cuarentena] = {
          id: row.id_cuarentena,
          latitud: row.latitud,
          longitud: row.longitud,
          radio: row.radio,
          comentario: row.comentario,
          activa: row.activa,
          conexiones: [] // Cambié a conexiones
        };
      }
    
      acc[row.id_cuarentena].conexiones.push({
        id_conexion: row.id_conexion,
        latitud_INI: row.latitud_INI,
        longitud_INI: row.longitud_INI,
        latitud_END: row.latitud_END,
        longitud_END: row.longitud_END,
        orden: row.ORDEN,
      });
      return acc;
    }, {});

    res.json(Object.values(quarantines));
  } catch (error) {
    console.error('Error al obtener cuarentenas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deactivateQuarantine = async (req, res) => {
 // console.log('Llegó la solicitud de desactivación al servidor');
 // console.log('ID de cuarentena recibido en el servidor:', req.params.id);

  const { id } = req.params;

  try {
      // Realizar la actualización para poner activa = 0
      const sqlQuery = 
          `UPDATE cuarentena
          SET activa = 0
          WHERE id_cuarentena = @id
          AND activa = 1`;

      // Ejecutar la consulta
      await query(sqlQuery, [
        { name: 'id', type: sql.Int, value: id }
      ]);

      res.json({ success: true, message: 'Cuarentena desactivada' });

  } catch (error) {
      console.error('Error al desactivar cuarentena:', error.message);
      res.status(500).json({
          success: false,
          error: 'Error al desactivar la cuarentena: ' + error.message
      });
  }
};

const activateQuarantine = async (req, res) => {
 // console.log('Llegó la solicitud de desactivación al servidor');
 // console.log('ID de cuarentena recibido en el servidor:', req.params.id);

  const { id } = req.params;

  try {
      // Realizar la actualización para poner activa = 1
      const sqlQuery = 
          `UPDATE cuarentena
          SET activa = 1
          WHERE id_cuarentena = @id
          AND activa = 0`;

      // Ejecutar la consulta
      await query(sqlQuery, [
        { name: 'id', type: sql.Int, value: id }
      ]);

      res.json({ success: true, message: 'Cuarentena activada' });

  } catch (error) {
      console.error('Error al desactivar cuarentena:', error.message);
      res.status(500).json({
          success: false,
          error: 'Error al desactivar la cuarentena: ' + error.message
      });
  }
};

      
module.exports = {
  saveQuarantine,
  getAllQuarantines,
  getAllRadiusQuarantines,
  getComentario,
  getComunaInactiva,
  getComentarioInactiva,
  getComuna, 
  getInactiveQuarantines,
  deactivateQuarantine,
  getInactivaTrazado,
  activateQuarantine
};