const { query } = require('../../config/db');

// Datos para exportar a Excel: registros de parcelas y cuarentenas.
// Respeta permisos: solo incluye lo que el rol puede VER.
// NO expone datos de usuarios ni de la bitácora de accesos.
const datosExport = async (req, res) => {
  try {
    const out = { success: true };
    const puedeVer = res.locals.puedeVer || (() => false);

    if (puedeVer('parcelaciones')) {
      out.parcelas = await query(`
        SELECT p.id_parcelacion AS ID, s.comuna AS Comuna, f.nombre AS Fase, c.nombre AS Cultivo,
               p.latitud AS Latitud, p.longitud AS Longitud,
               CASE WHEN p.registrada = 1 THEN 'Registrada' ELSE 'No registrada' END AS Estado
        FROM parcelacion p
        JOIN sector  s ON p.id_sector  = s.id_sector
        JOIN fase    f ON p.id_fase    = f.id_fase
        JOIN cultivo c ON p.id_cultivo = c.id_cultivo
        ORDER BY p.id_parcelacion
      `);
    }

    if (puedeVer('cuarentenas')) {
      out.cuarentenas = await query(`
        SELECT c.id_cuarentena AS ID, s.comuna AS Comuna,
               CASE WHEN c.radio IS NOT NULL AND c.radio > 0 THEN 'Radio' ELSE 'Trazado' END AS Tipo,
               c.radio AS Radio_m, c.latitud AS Latitud, c.longitud AS Longitud,
               c.comentario AS Comentario,
               CASE WHEN c.activa = 1 THEN 'Activa' ELSE 'Inactiva' END AS Estado
        FROM cuarentena c
        LEFT JOIN sector s ON c.id_sector = s.id_sector
        ORDER BY c.id_cuarentena
      `);
    }

    res.json(out);
  } catch (err) {
    console.error('Error al obtener datos para exportar:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { datosExport };
