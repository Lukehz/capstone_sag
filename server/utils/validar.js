// ---------------------------------------------------------------------------
//  Utilidades de validación para los endpoints de escritura.
//  Centraliza un criterio consistente: campos obligatorios, rangos de
//  coordenadas y existencia de claves foráneas.
// ---------------------------------------------------------------------------
const { query, sql } = require('../config/db');

// Devuelve los nombres de los campos faltantes: null, undefined, '' o solo
// espacios. OJO: 0 y false NO se consideran faltantes (son valores válidos).
function camposFaltantes(obj, requeridos) {
  return requeridos.filter(function (c) {
    const v = obj[c];
    if (v === undefined || v === null) return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    return false;
  });
}

function esEnteroPositivo(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

function latitudValida(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -90 && n <= 90;
}

function longitudValida(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= -180 && n <= 180;
}

// ¿Existe una fila con ese id? Para validar claves foráneas antes de insertar.
// `tabla` y `columna` son literales internos del servidor (no provienen del
// usuario), por lo que es seguro interpolarlos; el valor sí va parametrizado.
async function existeId(tabla, columna, valor) {
  if (!esEnteroPositivo(valor)) return false;
  const rows = await query(
    'SELECT TOP 1 1 AS ok FROM ' + tabla + ' WHERE ' + columna + ' = @id',
    [{ name: 'id', type: sql.Int, value: Number(valor) }]
  );
  return rows.length > 0;
}

module.exports = {
  camposFaltantes,
  esEnteroPositivo,
  latitudValida,
  longitudValida,
  existeId
};
