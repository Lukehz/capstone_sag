// ---------------------------------------------------------------------------
//  Estado de carga del mapa (banner superior).
//  Coordina varias cargas asíncronas (parcelas + cuarentenas) con un contador:
//  begin() al iniciar cada carga, done() al terminar, fail() si alguna falla.
//  El botón "Reintentar" vuelve a ejecutar los recargadores registrados.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  var pending = 0;
  var failed = false;
  var reloaders = [];

  function node() { return document.getElementById('map-status'); }

  function show(html) {
    var n = node();
    if (n) { n.innerHTML = html; n.style.display = 'flex'; }
  }
  function hide() {
    var n = node();
    if (n) { n.style.display = 'none'; n.innerHTML = ''; }
  }

  function begin() {
    pending++;
    failed = false;
    show('<span class="ui-spinner" aria-hidden="true"></span><span>Cargando datos del mapa…</span>');
  }
  function done() {
    pending = Math.max(0, pending - 1);
    if (pending === 0 && !failed) hide();
  }
  function fail() {
    failed = true;
    pending = Math.max(0, pending - 1);
    show('<span><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> No se pudieron cargar los datos del mapa.</span>' +
         '<button type="button" class="ui-retry"><i class="fas fa-redo" aria-hidden="true"></i> Reintentar</button>');
    var n = node();
    var btn = n ? n.querySelector('.ui-retry') : null;
    if (btn) btn.addEventListener('click', function () { retry(); });
  }
  function retry() {
    failed = false;
    reloaders.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  function register(fn) { if (typeof fn === 'function') reloaders.push(fn); }

  window.MapLoad = { begin: begin, done: done, fail: fail, register: register };
})();
