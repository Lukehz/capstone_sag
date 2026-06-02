const { connectDB, sql, query } = require('../config/db');
const { cacheado, invalidar } = require('../utils/cacheMapa');
const { latitudValida, longitudValida, existeId } = require('../utils/validar');
const { registrarAuditoria } = require('../utils/auditoria');
const { describirCuarentena } = require('../utils/auditDescripcion');

const saveQuarantine = async (req, res) => {
  const { points, comment: comentario, type, radius, idSector } = req.body;

  // --- Validación de entrada (antes de abrir la transacción) ---
  if (!comentario || typeof comentario !== 'string' || comentario.trim() === '') {
    return res.status(400).json({ success: false, error: 'El comentario es obligatorio.' });
  }
  if (!idSector) {
    return res.status(400).json({ success: false, error: 'Debe seleccionar un sector.' });
  }
  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ success: false, error: 'Faltan los puntos de la cuarentena.' });
  }

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

  // Coordenadas del punto base dentro de rango.
  if (!latitudValida(latitud) || !longitudValida(longitud)) {
    return res.status(400).json({ success: false, error: 'Las coordenadas están fuera de rango.' });
  }
  // En un trazado, todos los vértices deben tener coordenadas válidas.
  if (type === 'polygon') {
    const verticeInvalido = points.some(function (p) {
      return !Array.isArray(p) || p.length !== 2 || !longitudValida(p[0]) || !latitudValida(p[1]);
    });
    if (verticeInvalido) {
      return res.status(400).json({ success: false, error: 'Hay vértices con coordenadas inválidas.' });
    }
  }

  let pool;
  let transaction;
  let idCuarentena;

  try {
    // Clave foránea: el sector debe existir (lectura previa, sin transacción abierta).
    if (!(await existeId('sector', 'id_sector', idSector))) {
      return res.status(400).json({ success: false, error: 'El sector seleccionado no existe.' });
    }

    pool = await connectDB();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

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

    // Paso 3: Guardar los vértices solo si es un trazado.
    // La cuarentena recién se creó, así que sus vértices no existen aún: los
    // insertamos todos en UNA sola consulta (antes era 1 SELECT + 1 INSERT por punto).
    if (type === 'polygon' && uniquePoints.length > 0) {
      const reqVertices = transaction.request();
      reqVertices.input('id_cuarentena', sql.Int, idCuarentena);
      const valores = uniquePoints.map((p, i) => {
        reqVertices.input(`lat${i}`, sql.Float, p[1]);
        reqVertices.input(`lng${i}`, sql.Float, p[0]);
        reqVertices.input(`ord${i}`, sql.Int, i + 1);
        return `(@id_cuarentena, @lat${i}, @lng${i}, @ord${i})`;
      }).join(', ');
      await reqVertices.query(
        `INSERT INTO dbo.vertice (id_cuarentena, latitud, longitud, orden) VALUES ${valores}`
      );
    }

    // Ejecutar el procedimiento almacenado
    await transaction.request()
      .input('id_cuarentena', sql.Int, idCuarentena)
      .execute('sp_CrearConexionesCuarentena');
    //console.log(`Procedimiento almacenado ejecutado para la cuarentena ID: ${idCuarentena}`);

    // Confirmar la transacción
    await transaction.commit();
    invalidar(); // los datos del mapa cambiaron
    await registrarAuditoria(req, {
      entidad: 'cuarentena', accion: 'crear', idEntidad: idCuarentena,
      detalle: await describirCuarentena(idCuarentena)
    });
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
  }
  // Nota: NO cerramos el pool aquí; es compartido (lo cierra db.js al apagar el servidor).
};



const getAllQuarantines = async (req, res) => {
  try {
    const data = await cacheado('cuar:activas:trazado', async () => {
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
            conexiones: []
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

      return Object.values(quarantines);
    });

    res.json(data);
  } catch (error) {
    console.error('Error al obtener cuarentenas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllRadiusQuarantines = async (req, res) => {
  try {
    const data = await cacheado('cuar:radio', async () => {
      const result = await sql.query(`
        SELECT id_cuarentena, latitud, longitud, radio, comentario, activa
        FROM dbo.cuarentena
        WHERE radio IS NOT NULL
        ORDER BY id_cuarentena
      `);
      return result.recordset.map(row => ({
        id: row.id_cuarentena,
        latitud: row.latitud,
        longitud: row.longitud,
        radio: row.radio,
        comentario: row.comentario,
        activa: row.activa
      }));
    });

    res.json(data);
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
    // Realizar la consulta correctamente (cacheada)
    const filas = await cacheado('cuar:inactivas', async () => {
      const result = await sql.query(`
        SELECT id_cuarentena, latitud, longitud, radio, id_sector, comentario, activa
        FROM dbo.cuarentena
        WHERE activa = 0
      `);
      return result.recordset;
    });

    // Si no hay resultados, devolver un mensaje más claro
    if (filas.length === 0) {
      return res.status(404).json({ message: 'No se encontraron cuarentenas inactivas.' });
    }

    // Responder con los resultados
    res.json(filas);
  } catch (err) {
    console.error('Error al obtener inactivas:', err);
    res.status(500).json({ error: 'Error al obtener información: ' + err.message });
  }
};




const getInactivaTrazado = async (req, res) => {
  try {
    const data = await cacheado('cuar:inactivas:trazado', async () => {
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
            conexiones: []
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

      return Object.values(quarantines);
    });

    res.json(data);
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

      invalidar(); // los datos del mapa cambiaron
      await registrarAuditoria(req, { entidad: 'cuarentena', accion: 'editar', idEntidad: id, detalle: 'desactivada' });
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

      invalidar(); // los datos del mapa cambiaron
      await registrarAuditoria(req, { entidad: 'cuarentena', accion: 'editar', idEntidad: id, detalle: 'activada' });
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