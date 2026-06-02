// ---------------------------------------------------------------------------
//  Auditoría de operaciones CRUD.
//  Registra QUIÉN (usuario de la sesión) hizo QUÉ (crear/editar/eliminar)
//  sobre QUÉ entidad. A diferencia del trigger de `historial` (respaldo de
//  datos de parcelaciones), aquí queda el usuario responsable.
//
//  Es "best-effort": si el registro de auditoría falla, NO debe romper la
//  operación principal; solo se deja constancia en consola.
// ---------------------------------------------------------------------------
const { query, sql } = require('../config/db');

async function registrarAuditoria(req, datos) {
  const { entidad, accion, idEntidad = null, detalle = null } = datos || {};
  try {
    const u = (req && req.session && req.session.usuario) || {};
    await query(
      `INSERT INTO auditoria (id_usuario, usuario, rol, entidad, accion, id_entidad, detalle)
       VALUES (@id_usuario, @usuario, @rol, @entidad, @accion, @id_entidad, @detalle)`,
      [
        { name: 'id_usuario', type: sql.Int,      value: u.userId != null ? Number(u.userId) : null },
        { name: 'usuario',    type: sql.NVarChar, value: u.username || null },
        { name: 'rol',        type: sql.NVarChar, value: u.role || null },
        { name: 'entidad',    type: sql.NVarChar, value: entidad },
        { name: 'accion',     type: sql.NVarChar, value: accion },
        { name: 'id_entidad', type: sql.Int,      value: idEntidad != null ? Number(idEntidad) : null },
        { name: 'detalle',    type: sql.NVarChar, value: detalle }
      ]
    );
  } catch (e) {
    console.error('No se pudo registrar la auditoría:', e.message);
  }
}

module.exports = { registrarAuditoria };
