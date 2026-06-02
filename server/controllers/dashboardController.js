const { query } = require('../config/db');

// ---------------------------------------------------------------------------
//  Resumen general — visible para cualquier rol con acceso al dashboard.
//  Datos de parcelaciones, cuarentenas, territorio y actividad reciente.
// ---------------------------------------------------------------------------
const resumen = async (req, res) => {
    try {
        const [kpis, porCultivo, porFase, porRegion, porMes, actividad] = await Promise.all([
            query(`
                SELECT
                  (SELECT COUNT(*) FROM parcelacion)                       AS parcelaciones_total,
                  (SELECT COUNT(*) FROM parcelacion WHERE registrada = 1)  AS parcelaciones_registradas,
                  (SELECT COUNT(*) FROM cuarentena)                        AS cuarentenas_total,
                  (SELECT COUNT(*) FROM cuarentena WHERE activa = 1)       AS cuarentenas_activas,
                  (SELECT COUNT(*) FROM cultivo)                           AS cultivos_total,
                  (SELECT COUNT(*) FROM sector)                            AS sectores_total,
                  (SELECT COUNT(*) FROM region)                            AS regiones_total,
                  (SELECT COUNT(*) FROM provincia)                         AS provincias_total,
                  (SELECT COUNT(*) FROM fase)                              AS fases_total
            `),
            query(`
                SELECT c.nombre AS etiqueta, COUNT(*) AS valor
                FROM parcelacion p JOIN cultivo c ON p.id_cultivo = c.id_cultivo
                GROUP BY c.nombre ORDER BY valor DESC
            `),
            query(`
                SELECT f.nombre AS etiqueta, COUNT(*) AS valor
                FROM parcelacion p JOIN fase f ON p.id_fase = f.id_fase
                GROUP BY f.nombre ORDER BY valor DESC
            `),
            query(`
                SELECT r.nombre AS etiqueta, COUNT(*) AS valor
                FROM parcelacion p
                JOIN sector s     ON p.id_sector   = s.id_sector
                JOIN provincia pr ON s.id_provincia = pr.id_provincia
                JOIN region r     ON pr.id_region   = r.id_region
                GROUP BY r.nombre ORDER BY valor DESC
            `),
            query(`
                SELECT FORMAT(fecha_creacion, 'yyyy-MM') AS etiqueta, COUNT(*) AS valor
                FROM parcelacion
                WHERE fecha_creacion >= DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1))
                GROUP BY FORMAT(fecha_creacion, 'yyyy-MM')
                ORDER BY etiqueta
            `),
            query(`
                SELECT TOP 8 accion, nombre, CONVERT(varchar(10), fecha, 23) AS fecha
                FROM historial ORDER BY fecha DESC, hora DESC
            `)
        ]);

        res.json({
            kpis: kpis[0] || {},
            porCultivo,
            porFase,
            porRegion,
            porMes,
            actividad
        });
    } catch (error) {
        console.error('Error en dashboard/resumen:', error.message);
        res.status(500).json({ message: 'Error al obtener el resumen del dashboard' });
    }
};

// ---------------------------------------------------------------------------
//  Estadísticas de usuarios — SOLO administrador.
//  La ruta está protegida con requiereVer('usuarios'); este controlador
//  asume que el guard ya validó el acceso.
// ---------------------------------------------------------------------------
const usuarios = async (req, res) => {
    try {
        const [kpis, porRol, porTema, ultimos, usuariosRaw] = await Promise.all([
            query(`
                SELECT
                  (SELECT COUNT(*) FROM usuario)                  AS usuarios_total,
                  (SELECT COUNT(*) FROM rol)                      AS roles_total,
                  (SELECT COUNT(*) FROM usuario WHERE tema='dark') AS tema_oscuro,
                  (SELECT COUNT(*) FROM usuario WHERE tema<>'dark') AS tema_claro
            `),
            query(`
                SELECT rol AS etiqueta, COUNT(*) AS valor
                FROM usuario GROUP BY rol ORDER BY valor DESC
            `),
            query(`
                SELECT tema AS etiqueta, COUNT(*) AS valor
                FROM usuario GROUP BY tema
            `),
            query(`
                SELECT TOP 6 nombre, apellido, usuario, rol,
                       CONVERT(varchar(10), fecha_creacion, 23) AS fecha
                FROM usuario ORDER BY fecha_creacion DESC, id_usuario DESC
            `),
            query(`SELECT rol, tema FROM usuario`)
        ]);

        res.json({
            kpis: kpis[0] || {},
            porRol,
            porTema,
            ultimos,
            usuariosRaw
        });
    } catch (error) {
        console.error('Error en dashboard/usuarios:', error.message);
        res.status(500).json({ message: 'Error al obtener las estadísticas de usuarios' });
    }
};

// ---------------------------------------------------------------------------
//  Datos crudos por parcela (una fila por parcela) para los gráficos
//  interactivos del panel: permite recalcular y filtrar en el cliente.
// ---------------------------------------------------------------------------
const parcelasRaw = async (req, res) => {
    try {
        const parcelas = await query(`
            SELECT c.nombre AS cultivo, f.nombre AS fase, r.nombre AS region,
                   FORMAT(p.fecha_creacion, 'yyyy-MM') AS mes
            FROM parcelacion p
            JOIN cultivo c    ON p.id_cultivo   = c.id_cultivo
            JOIN fase f       ON p.id_fase      = f.id_fase
            JOIN sector s     ON p.id_sector    = s.id_sector
            JOIN provincia pr ON s.id_provincia = pr.id_provincia
            JOIN region r     ON pr.id_region   = r.id_region
        `);
        res.json({ parcelas });
    } catch (error) {
        console.error('Error en dashboard/parcelas-raw:', error.message);
        res.status(500).json({ message: 'Error al obtener datos de parcelas' });
    }
};

module.exports = { resumen, usuarios, parcelasRaw };