/* registroAcceso.js
   Inserta un registro en la tabla acceso_log (bitácora de ingresos).
   Nunca lanza: si el log falla, no debe romper el login/logout. */

const { sql, query } = require('../config/db');

async function registrarAcceso(req, datos) {
  try {
    const ip = (
      (req && (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress))) || ''
    ).toString().split(',')[0].trim().slice(0, 60);
    const ua = ((req && req.headers['user-agent']) || '').toString().slice(0, 300);

    await query(
      `INSERT INTO acceso_log (id_usuario, usuario, nombre, rol, evento, exito, ip, user_agent)
       VALUES (@id_usuario, @usuario, @nombre, @rol, @evento, @exito, @ip, @ua)`,
      [
        { name: 'id_usuario', type: sql.Int,      value: datos.idUsuario != null ? datos.idUsuario : null },
        { name: 'usuario',    type: sql.NVarChar, value: datos.usuario != null ? String(datos.usuario).slice(0, 50) : null },
        { name: 'nombre',     type: sql.NVarChar, value: datos.nombre != null ? String(datos.nombre).slice(0, 80) : null },
        { name: 'rol',        type: sql.NVarChar, value: datos.rol != null ? String(datos.rol).slice(0, 50) : null },
        { name: 'evento',     type: sql.NVarChar, value: String(datos.evento || 'login').slice(0, 20) },
        { name: 'exito',      type: sql.Bit,      value: datos.exito ? 1 : 0 },
        { name: 'ip',         type: sql.NVarChar, value: ip || null },
        { name: 'ua',         type: sql.NVarChar, value: ua || null },
      ]
    );
  } catch (e) {
    console.error('Error registrando acceso:', e.message);
  }
}

module.exports = { registrarAcceso };
