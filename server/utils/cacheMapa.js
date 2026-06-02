// Caché en memoria para los datos del mapa (parcelas y cuarentenas).
// Estos datos cambian poco, así que evitamos consultar la BDD en cada carga.
// Se refresca solo por TTL y, sobre todo, se limpia cuando hay cambios
// (crear / editar / eliminar parcelas o cuarentenas).
//
// Nota: la caché vive en memoria del servidor, así que es compartida por todos
// los usuarios de esa instancia. Al invalidar tras una escritura, el próximo
// pedido de cualquiera (incluido otro usuario al recargar) trae datos frescos.

const store = new Map();
const TTL_MS = 60 * 1000; // 60 s de vigencia (red de seguridad por si algo no invalida)

// Devuelve lo cacheado para `key` si sigue fresco; si no, ejecuta `fn`,
// guarda el resultado y lo devuelve.
async function cacheado(key, fn) {
  const item = store.get(key);
  if (item && Date.now() < item.expira) {
    return item.valor; // HIT
  }
  const valor = await fn(); // MISS: calcular y guardar
  store.set(key, { valor, expira: Date.now() + TTL_MS });
  return valor;
}

// Borra toda la caché del mapa. Llamar al crear/editar/eliminar
// parcelas o cuarentenas para que la próxima lectura sea fresca.
function invalidar() {
  store.clear();
}

module.exports = { cacheado, invalidar };
