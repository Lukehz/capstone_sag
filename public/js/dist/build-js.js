/*
 * build-js.js — Empaqueta el JavaScript del cliente SIN minificar (conserva comentarios).
 *
 * - Mapa: los 6 módulos ES (map, quarantine, parcelas, api, sidebar, filter) se
 *   empaquetan con Rollup en un único archivo `dist/map.bundle.js` (type="module").
 * - El resto son scripts clásicos (IIFE / globales): se CONCATENAN en orden, que es
 *   idéntico a cargarlos por separado. Se inserta `;` entre archivos para evitar que
 *   un IIFE se "pegue" al siguiente.
 *
 * Uso:  node scripts/build-js.js     (o:  npm run build:js)
 * Salida:  public/js/dist/*.bundle.js
 */
const fs = require('fs');
const path = require('path');
const rollup = require('rollup');

const JS = path.join(__dirname, '..', 'public', 'js');
const DIST = path.join(JS, 'dist');

// Grupos de scripts clásicos (no-módulos): se concatenan en este orden.
const GRUPOS = {
  'map-libs.bundle.js': ['multiselect.js', 'impacto.js', 'mapStatus.js'],
  'crud.bundle.js':      ['estados.js', 'script.js', 'multiselect.js'],
  'dashboard.bundle.js': ['estados.js', 'dashboard.js', 'reportes.js'],
  'roles.bundle.js':     ['estados.js', 'roles.js'],
  'bitacora.bundle.js':  ['estados.js', 'bitacora.js'],
};

// Módulos ES del mapa (se resuelven los import entre sí; map.js queda incluido una vez).
const MAPA_MODULOS = ['map.js', 'quarantine.js', 'parcelas.js', 'api.js', 'sidebar.js', 'filter.js'];

function concatenarGrupos() {
  for (const [salida, archivos] of Object.entries(GRUPOS)) {
    const partes = archivos.map((f) => {
      const codigo = fs.readFileSync(path.join(JS, f), 'utf8');
      return '/* ===== ' + f + ' ===== */\n' + codigo;
    });
    // El "\n;\n" entre archivos evita que un IIFE invoque al siguiente por accidente.
    fs.writeFileSync(path.join(DIST, salida), partes.join('\n;\n') + '\n', 'utf8');
    console.log('  concatenado ->', 'dist/' + salida, '(' + archivos.join(' + ') + ')');
  }
}

async function empaquetarMapa() {
  const entrada = path.join(JS, '_entry_map.js');
  fs.writeFileSync(entrada, MAPA_MODULOS.map((f) => "import './" + f + "';").join('\n') + '\n', 'utf8');
  try {
    const bundle = await rollup.rollup({ input: entrada });
    await bundle.write({ file: path.join(DIST, 'map.bundle.js'), format: 'es' });
    await bundle.close();
    console.log('  empaquetado ->', 'dist/map.bundle.js', '(' + MAPA_MODULOS.join(' + ') + ')');
  } finally {
    fs.unlinkSync(entrada); // la entrada es temporal, no se publica
  }
}

(async () => {
  fs.mkdirSync(DIST, { recursive: true });
  console.log('Generando bundles (sin minificar)...');
  await empaquetarMapa();
  concatenarGrupos();
  console.log('Listo. Bundles en public/js/dist/');
})().catch((e) => { console.error(e); process.exit(1); });
