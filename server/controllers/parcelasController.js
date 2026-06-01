const { connectDB, sql } = require('../config/db');

const getParcelas = async (req, res, next) => {
  try {
    const result = await sql.query('SELECT * FROM vw_parcelacion');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error en getParcelas:', err); // Imprime el error para depuración
    next(new Error('Error al obtener parcelas: ' + err.message));
  }
};

const getComuna = async (req, res, next) => {
  try {
    // Ejecutar la consulta
    const result = await sql.query(`
      SELECT p.id_parcelacion, p.latitud, p.longitud, s.comuna, c.nombre AS cultivo
      FROM parcelacion p
      INNER JOIN sector s ON p.id_sector = s.id_sector
      INNER JOIN cultivo c ON p.id_cultivo = c.id_cultivo
    `);

    // Devolver los resultados como JSON
    res.json(result.recordset);
  } catch (err) {
    console.error('Error en getComuna:', err); // Imprime el error para depuración
    next(new Error('Error al obtener las comunas: ' + err.message));
  }
};

const deleteParcela = async (req, res) => {
  const { id } = req.params; // Verificar si el ID está llegando correctamente
  let transaction;

  try {
    // Verifica si el ID es un número válido
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    // Comenzar la transacción
    transaction = new sql.Transaction();
    await transaction.begin();

    // Realiza la eliminación
    const result = await transaction.request()
      .input('id_parcelacion', sql.Int, id) // Asegúrate de que el ID sea pasado correctamente
      .query('DELETE FROM parcelacion WHERE id_parcelacion = @id_parcelacion');

    await transaction.commit();

    if (result.rowsAffected[0] > 0) {
     // console.log(`Parcela con ID ${id} eliminada correctamente.`);
      res.json({ success: true, message: `Parcela con ID ${id} eliminada exitosamente.` });
    } else {
      //console.log(`No se encontró una parcela con ID ${id}.`);
      res.status(404).json({ success: false, message: `No se encontró una parcela con ID ${id}.` });
    }

  } catch (error) {
    console.error('Error al eliminar la parcela:', error);
    if (transaction) await transaction.rollback();
    res.status(500).json({ success: false, message: 'Error al eliminar la parcela' });
  }
};

const getParcelDataOptions = async (req, res, next) => {
  try {
    const comunaQuery = 'SELECT id_sector, comuna FROM sector';
    const faseQuery = 'SELECT id_fase, nombre FROM fase';
    const cultivoQuery = 'SELECT id_cultivo, nombre FROM cultivo';

    // Ejecuta las consultas de manera independiente sin conexión explícita
    const [comunasResult, fasesResult, cultivosResult] = await Promise.all([
      sql.query(comunaQuery),
      sql.query(faseQuery),
      sql.query(cultivoQuery),
    ]);

    //console.log('Datos obtenidos de la base de datos:', {
     // comunas: comunasResult.recordset,
     // fases: fasesResult.recordset,
     // cultivos: cultivosResult.recordset,
    //});

    res.json({
      success: true,
      data: {
        comunas: comunasResult.recordset,
        fases: fasesResult.recordset,
        cultivos: cultivosResult.recordset,
      },
    });

   // console.log('Respuesta enviada al frontend:', {
    //  success: true,
     // data: {
      //  comunas: comunasResult.recordset,
       // fases: fasesResult.recordset,
       // cultivos: cultivosResult.recordset,
     // },
   // });

  } catch (error) {
    console.error('Error al obtener opciones para creación de parcela:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener los datos de la base de datos',
      details: error.message 
    });
  }
};

const SaveParcel = async (req, res) => {
  try {
    const { latitud, longitud, id_sector, id_fase, id_cultivo, registrada } = req.body;

    if (!latitud || !longitud || !id_sector || !id_fase || !id_cultivo || registrada === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios.',
      });
    }

    const insertQuery = `
      INSERT INTO parcelacion (latitud, longitud, id_sector, id_fase, id_cultivo, registrada)
      VALUES (@latitud, @longitud, @id_sector, @id_fase, @id_cultivo, @registrada);`;
    const pool = await sql.connect();
    await pool.request()
      .input('latitud', sql.Float, latitud)
      .input('longitud', sql.Float, longitud)
      .input('id_sector', sql.Int, id_sector)
      .input('id_fase', sql.Int, id_fase)
      .input('id_cultivo', sql.Int, id_cultivo)
      .input('registrada', sql.Bit, parseInt(registrada)) // Asegura que el valor sea entero (1 o 0)
      .query(insertQuery);

    return res.status(201).json({
      success: true,
      message: 'Parcelación guardada exitosamente.',
    });
  } catch (error) {
    console.error('Error al guardar la parcelación:', error);
    return res.status(500).json({
      success: false,
      message: 'Hubo un error al guardar la parcelación.',
      error: error.message,
    });
  }
};

module.exports = {
  SaveParcel,
  getParcelDataOptions, 
  getParcelas,
  deleteParcela,
  getComuna
};