/* rolController.js
   Gestión de roles (RBAC): crear, listar, obtener, editar y eliminar roles,
   definiendo por cada apartado su nivel (N/L/A) y las capacidades especiales.
   Tras cualquier cambio se limpia la caché de permisos para que aplique solo. */

const { sql, query } = require('../../config/db');
const { limpiarCache } = require('../../Middlewares/permisos');
const { registrarAuditoria } = require('../../utils/auditoria');

// Genera un código (slug) estable a partir del nombre del rol.
function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || 'rol';
}

// Apartados internos que NO se gestionan desde la matriz de roles
// (p. ej. 'historial' es un respaldo interno alimentado por trigger).
const APARTADOS_OCULTOS = ['historial'];
// Apartados de solo lectura: en la matriz muestran solo "Sin acceso / Ver".
const APARTADOS_SOLO_LECTURA = ['bitacora'];
// Apartados obligatorios: siempre "Ver" (no se puede quitar el acceso).
const APARTADOS_OBLIGATORIOS = ['mapa'];

// Catálogos para construir la matriz en el cliente.
async function catalogos(req, res) {
  try {
    const ocultos = APARTADOS_OCULTOS.map((c) => `'${c}'`).join(',');
    const apartados = await query(
      `SELECT codigo, nombre, orden FROM apartado` +
      (ocultos ? ` WHERE codigo NOT IN (${ocultos})` : '') +
      ` ORDER BY orden, nombre`
    );
    apartados.forEach((a) => {
      a.solo_lectura = APARTADOS_SOLO_LECTURA.includes(a.codigo) ? 1 : 0;
      a.obligatorio = APARTADOS_OBLIGATORIOS.includes(a.codigo) ? 1 : 0;
    });
    const niveles = await query('SELECT codigo, nombre, descripcion FROM nivel_acceso ORDER BY id_nivel');
    const capacidades = await query('SELECT codigo, nombre FROM capacidad ORDER BY codigo');
    res.json({ apartados, niveles, capacidades });
  } catch (e) {
    console.error('catalogos rol:', e);
    res.status(500).json({ error: 'Error al cargar catálogos' });
  }
}

// Lista de roles con cuántos usuarios tiene cada uno.
async function listar(req, res) {
  try {
    const roles = await query(`
      SELECT r.id_rol, r.codigo, r.nombre, r.descripcion,
             (SELECT COUNT(*) FROM usuario u WHERE LOWER(u.rol) = r.codigo) AS usuarios
      FROM rol r
      ORDER BY r.id_rol`);
    res.json(roles);
  } catch (e) {
    console.error('listar rol:', e);
    res.status(500).json({ error: 'Error al listar roles' });
  }
}

// Detalle de un rol: niveles por apartado + capacidades.
async function obtener(req, res) {
  try {
    const id = parseInt(req.params.id);
    const base = await query('SELECT id_rol, codigo, nombre, descripcion FROM rol WHERE id_rol = @id',
      [{ name: 'id', type: sql.Int, value: id }]);
    if (!base.length) return res.status(404).json({ error: 'Rol no encontrado' });

    const aps = await query(`
      SELECT a.codigo AS apartado, n.codigo AS nivel
      FROM rol_apartado_permiso rap
      JOIN apartado a     ON a.id_apartado = rap.id_apartado
      JOIN nivel_acceso n ON n.id_nivel    = rap.id_nivel
      WHERE rap.id_rol = @id`, [{ name: 'id', type: sql.Int, value: id }]);

    const caps = await query(`
      SELECT c.codigo
      FROM rol_capacidad rc
      JOIN capacidad c ON c.id_capacidad = rc.id_capacidad
      WHERE rc.id_rol = @id`, [{ name: 'id', type: sql.Int, value: id }]);

    const apartados = {};
    aps.forEach((r) => { apartados[r.apartado] = r.nivel; });
    res.json({ ...base[0], apartados, capacidades: caps.map((c) => c.codigo) });
  } catch (e) {
    console.error('obtener rol:', e);
    res.status(500).json({ error: 'Error al obtener el rol' });
  }
}

// Construye el INSERT de apartados (solo niveles distintos de 'N') con parámetros.
function buildApartadosInsert(idParam, apartados, params, startIdx) {
  const pairs = Object.entries(apartados || {}).filter(([, niv]) => niv && niv !== 'N');
  if (!pairs.length) return '';
  const vals = pairs.map(([ap, niv], i) => {
    const idx = startIdx + i;
    params.push({ name: `a${idx}`, type: sql.NVarChar, value: ap });
    params.push({ name: `n${idx}`, type: sql.NVarChar, value: niv });
    return `(@a${idx}, @n${idx})`;
  }).join(',');
  return `
    INSERT INTO rol_apartado_permiso (id_rol, id_apartado, id_nivel)
    SELECT ${idParam}, a.id_apartado, nv.id_nivel
    FROM (VALUES ${vals}) AS m(apartado, nivel)
    JOIN apartado a      ON a.codigo  = m.apartado
    JOIN nivel_acceso nv ON nv.codigo = m.nivel;`;
}

// Construye el INSERT de capacidades con parámetros.
function buildCapacidadesInsert(idParam, capacidades, params) {
  const caps = (capacidades || []).filter(Boolean);
  if (!caps.length) return '';
  const ph = caps.map((c, i) => {
    params.push({ name: `c${i}`, type: sql.NVarChar, value: c });
    return `@c${i}`;
  }).join(',');
  return `
    INSERT INTO rol_capacidad (id_rol, id_capacidad)
    SELECT ${idParam}, c.id_capacidad FROM capacidad c WHERE c.codigo IN (${ph});`;
}

// Crear un rol nuevo.
async function crear(req, res) {
  try {
    const { nombre, descripcion, apartados = {}, capacidades = [] } = req.body || {};
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Código único a partir del nombre.
    const base = slug(nombre);
    let codigo = base, i = 1;
    while ((await query('SELECT 1 FROM rol WHERE codigo = @c',
      [{ name: 'c', type: sql.NVarChar, value: codigo }])).length) {
      codigo = (base + '_' + (++i)).slice(0, 30);
    }

    const params = [
      { name: 'codigo', type: sql.NVarChar, value: codigo },
      { name: 'nombre', type: sql.NVarChar, value: String(nombre).trim() },
      { name: 'descripcion', type: sql.NVarChar, value: descripcion ? String(descripcion).trim() : null },
    ];
    const apInsert = buildApartadosInsert('@idrol', apartados, params, 0);
    const capInsert = buildCapacidadesInsert('@idrol', capacidades, params);

    const batch = `
      SET XACT_ABORT ON;
      BEGIN TRAN;
      INSERT INTO rol (codigo, nombre, descripcion) VALUES (@codigo, @nombre, @descripcion);
      DECLARE @idrol INT = SCOPE_IDENTITY();
      ${apInsert}
      ${capInsert}
      COMMIT;
      SELECT @idrol AS id_rol;`;

    const r = await query(batch, params);
    limpiarCache();
    const nuevoId = (r && r[0] && r[0].id_rol) || null;
    await registrarAuditoria(req, { entidad: 'rol', accion: 'crear', idEntidad: nuevoId, detalle: nombre + ' (' + codigo + ')' });
    res.status(201).json({ ok: true, id_rol: nuevoId, codigo });
  } catch (e) {
    console.error('crear rol:', e);
    res.status(500).json({ error: 'Error al crear el rol' });
  }
}

// Editar un rol existente (reemplaza sus permisos y capacidades).
async function actualizar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { nombre, descripcion, apartados = {}, capacidades = [] } = req.body || {};
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const base = await query('SELECT codigo FROM rol WHERE id_rol = @id',
      [{ name: 'id', type: sql.Int, value: id }]);
    if (!base.length) return res.status(404).json({ error: 'Rol no encontrado' });

    const apEff = { ...apartados };
    // Proteger al Administrador: no puede quedarse sin gestionar usuarios ni roles.
    if (base[0].codigo === 'administrador') {
      apEff.usuarios = 'A';
      apEff.roles = 'A';
    }

    const params = [
      { name: 'id', type: sql.Int, value: id },
      { name: 'nombre', type: sql.NVarChar, value: String(nombre).trim() },
      { name: 'descripcion', type: sql.NVarChar, value: descripcion ? String(descripcion).trim() : null },
    ];
    const apInsert = buildApartadosInsert('@id', apEff, params, 0);
    const capInsert = buildCapacidadesInsert('@id', capacidades, params);

    const batch = `
      SET XACT_ABORT ON;
      BEGIN TRAN;
      UPDATE rol SET nombre = @nombre, descripcion = @descripcion WHERE id_rol = @id;
      DELETE FROM rol_apartado_permiso WHERE id_rol = @id;
      DELETE FROM rol_capacidad WHERE id_rol = @id;
      ${apInsert}
      ${capInsert}
      COMMIT;`;

    await query(batch, params);
    limpiarCache();
    await registrarAuditoria(req, { entidad: 'rol', accion: 'editar', idEntidad: id, detalle: base[0].codigo });
    res.json({ ok: true });
  } catch (e) {
    console.error('actualizar rol:', e);
    res.status(500).json({ error: 'Error al actualizar el rol' });
  }
}

// Eliminar un rol (protege al Administrador y bloquea si hay usuarios asignados).
async function eliminar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const base = await query('SELECT codigo FROM rol WHERE id_rol = @id',
      [{ name: 'id', type: sql.Int, value: id }]);
    if (!base.length) return res.status(404).json({ error: 'Rol no encontrado' });
    if (base[0].codigo === 'administrador') {
      return res.status(400).json({ error: 'No se puede eliminar el rol Administrador' });
    }
    const enUso = await query('SELECT COUNT(*) AS n FROM usuario WHERE LOWER(rol) = @c',
      [{ name: 'c', type: sql.NVarChar, value: base[0].codigo }]);
    if (enUso[0].n > 0) {
      return res.status(400).json({ error: `No se puede eliminar: ${enUso[0].n} usuario(s) tienen este rol` });
    }
    // Las tablas puente se borran en cascada (ON DELETE CASCADE).
    await query('DELETE FROM rol WHERE id_rol = @id', [{ name: 'id', type: sql.Int, value: id }]);
    limpiarCache();
    await registrarAuditoria(req, { entidad: 'rol', accion: 'eliminar', idEntidad: id, detalle: base[0].codigo });
    res.json({ ok: true });
  } catch (e) {
    console.error('eliminar rol:', e);
    res.status(500).json({ error: 'Error al eliminar el rol' });
  }
}

// Lista simple de roles (código + nombre) para poblar selects en formularios.
async function opciones(req, res) {
  try {
    const roles = await query('SELECT codigo, nombre FROM rol ORDER BY id_rol');
    res.json(roles);
  } catch (e) {
    console.error('opciones rol:', e);
    res.status(500).json({ error: 'Error al cargar roles' });
  }
}

module.exports = { catalogos, opciones, listar, obtener, crear, actualizar, eliminar };