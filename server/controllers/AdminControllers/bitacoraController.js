const { sql, query } = require('../../config/db');

// ---------------------------------------------------------------------------
//  Bitácora de accesos — SOLO LECTURA.
//  La tabla acceso_log se llena en el login/logout (server/utils/registroAcceso).
//  Las rutas están protegidas con requiereVer('bitacora').
// ---------------------------------------------------------------------------

// Lista de accesos con filtros opcionales (para la página de bitácora).
const listar = async (req, res) => {
  try {
    const { evento, q, exito, desde, hasta } = req.query;
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 300;
    if (limit > 1000) limit = 1000;

    const where = [];
    const params = [{ name: 'limit', type: sql.Int, value: limit }];

    if (evento) {
      where.push('evento = @evento');
      params.push({ name: 'evento', type: sql.NVarChar, value: String(evento).slice(0, 20) });
    }
    if (exito === '0' || exito === '1') {
      where.push('exito = @exito');
      params.push({ name: 'exito', type: sql.Bit, value: exito === '1' ? 1 : 0 });
    }
    if (q) {
      where.push('(usuario LIKE @q OR nombre LIKE @q OR ip LIKE @q)');
      params.push({ name: 'q', type: sql.NVarChar, value: '%' + String(q).slice(0, 60) + '%' });
    }
    if (desde) {
      where.push('fecha >= @desde');
      params.push({ name: 'desde', type: sql.DateTime2, value: new Date(desde) });
    }
    if (hasta) {
      where.push('fecha < DATEADD(DAY, 1, @hasta)');
      params.push({ name: 'hasta', type: sql.DateTime2, value: new Date(hasta) });
    }

    const sqlText = `
      SELECT TOP (@limit)
             id_acceso, id_usuario, usuario, nombre, rol, evento, exito, ip, user_agent, fecha
      FROM acceso_log
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY fecha DESC, id_acceso DESC`;

    const filas = await query(sqlText, params);
    res.json({ filas });
  } catch (e) {
    console.error('bitacora/listar:', e.message);
    res.status(500).json({ message: 'Error al obtener la bitácora de accesos' });
  }
};

// Resumen para el dashboard: KPIs + últimos accesos.
const resumen = async (req, res) => {
  try {
    const [kpis, ultimos] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)               FROM acceso_log WHERE evento = 'login' AND exito = 1 AND fecha >= CAST(SYSUTCDATETIME() AS DATE)) AS ingresos_hoy,
          (SELECT COUNT(DISTINCT id_usuario) FROM acceso_log WHERE evento = 'login' AND exito = 1 AND fecha >= CAST(SYSUTCDATETIME() AS DATE)) AS usuarios_hoy,
          (SELECT COUNT(*)               FROM acceso_log WHERE evento = 'login_fallido' AND fecha >= DATEADD(DAY, -7, SYSUTCDATETIME())) AS fallidos_7d,
          (SELECT COUNT(*)               FROM acceso_log) AS total
      `),
      query(`
        SELECT TOP 6 usuario, nombre, rol, evento, exito, ip, fecha
        FROM acceso_log
        WHERE evento IN ('login', 'login_fallido')
        ORDER BY fecha DESC, id_acceso DESC
      `)
    ]);

    res.json({ kpis: kpis[0] || {}, ultimos });
  } catch (e) {
    console.error('bitacora/resumen:', e.message);
    res.status(500).json({ message: 'Error al obtener el resumen de accesos' });
  }
};

module.exports = { listar, resumen };
