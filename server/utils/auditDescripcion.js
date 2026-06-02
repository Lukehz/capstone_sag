// ---------------------------------------------------------------------------
//  Descripciones legibles para el detalle de auditoría.
//  Leen la fila real (con nombres, no ids) y arman un texto descriptivo.
//  Son "best-effort": si algo falla, devuelven null y la auditoría sigue.
// ---------------------------------------------------------------------------
const { query, sql } = require('../config/db');

function coord(lat, lng) {
  const f = (x) => (x == null ? '?' : Number(x).toFixed(5));
  return f(lat) + ', ' + f(lng);
}

// Parcela: comuna, cultivo, fase y si está registrada.
async function describirParcela(id) {
  try {
    const r = await query(
      `SELECT p.registrada, f.nombre AS fase, c.nombre AS cultivo, s.comuna
       FROM parcelacion p
       JOIN fase f    ON p.id_fase    = f.id_fase
       JOIN cultivo c ON p.id_cultivo = c.id_cultivo
       JOIN sector s  ON p.id_sector  = s.id_sector
       WHERE p.id_parcelacion = @id`,
      [{ name: 'id', type: sql.Int, value: Number(id) }]
    );
    if (!r.length) return null;
    const p = r[0];
    return 'cultivo: ' + p.cultivo +
           ' · fase: ' + p.fase +
           ' · comuna: ' + p.comuna +
           ' · ' + (p.registrada ? 'registrada' : 'no registrada');
  } catch (e) {
    return null;
  }
}

// Cuarentena: tipo (trazado o radio con metros), ubicación y comentario.
async function describirCuarentena(id) {
  try {
    const r = await query(
      `SELECT latitud, longitud, radio, comentario FROM cuarentena WHERE id_cuarentena = @id`,
      [{ name: 'id', type: sql.Int, value: Number(id) }]
    );
    if (!r.length) return null;
    const c = r[0];
    const tipo = (c.radio != null) ? ('radio: ' + Math.round(c.radio) + ' m') : 'trazado';
    let s = tipo + ' · ubicación: ' + coord(c.latitud, c.longitud);
    if (c.comentario) s += ' · comentario: "' + c.comentario + '"';
    return s;
  } catch (e) {
    return null;
  }
}

module.exports = { describirParcela, describirCuarentena };