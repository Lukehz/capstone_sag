/* ===== estados.js ===== */
// ---------------------------------------------------------------------------
//  Estados de UI reutilizables: carga, vacío y error con "Reintentar".
//  Se renderizan dentro de un contenedor (un <div>, una celda, etc.).
//  Uso:
//    UIState.loading(nodo, 'Cargando…');
//    UIState.empty(nodo, 'Sin resultados.');
//    UIState.error(nodo, 'No se pudo cargar.', funcionDeReintento);
//    UIState.hide(nodo);
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  function box(cls, inner) {
    return '<div class="ui-state ' + cls + '">' + inner + '</div>';
  }

  function loading(node, msg) {
    if (!node) return;
    node.innerHTML = box('ui-state--loading',
      '<span class="ui-spinner" aria-hidden="true"></span><span>' + (msg || 'Cargando…') + '</span>');
  }

  function empty(node, msg) {
    if (!node) return;
    node.innerHTML = box('ui-state--empty',
      '<i class="fas fa-inbox" aria-hidden="true"></i><span>' + (msg || 'Sin datos.') + '</span>');
  }

  function error(node, msg, onRetry) {
    if (!node) return;
    node.innerHTML = box('ui-state--error',
      '<span><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> ' + (msg || 'No se pudo cargar.') + '</span>' +
      '<button type="button" class="ui-retry"><i class="fas fa-redo" aria-hidden="true"></i> Reintentar</button>');
    var btn = node.querySelector('.ui-retry');
    if (btn && typeof onRetry === 'function') {
      btn.addEventListener('click', function () { onRetry(); });
    }
  }

  function hide(node) { if (node) node.innerHTML = ''; }

  window.UIState = { loading: loading, empty: empty, error: error, hide: hide };
})();

;
/* ===== bitacora.js ===== */
/* bitacora.js — Bitácora de accesos (solo lectura).
   Lee /api/bitacora con filtros y arma la tabla. */
(function () {
  const $ = (id) => document.getElementById(id);

  // Nombres de íconos en Font Awesome 5 (el layout usa FA 5.15.4).
  const EVENTO = {
    login:         { txt: 'Ingreso',          cls: 'ok',  icon: 'fa-sign-in-alt' },
    logout:        { txt: 'Cierre de sesión', cls: 'neu', icon: 'fa-sign-out-alt' },
    login_fallido: { txt: 'Intento fallido',  cls: 'bad', icon: 'fa-exclamation-triangle' },
  };

  let timer = null;

  function fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // Resume el user-agent a algo legible: "Chrome · Windows".
  function simplificaUA(ua) {
    if (!ua) return '—';
    let nav = 'Otro', os = '';
    if (/Edg\//.test(ua)) nav = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) nav = 'Opera';
    else if (/Chrome\//.test(ua)) nav = 'Chrome';
    else if (/Firefox\//.test(ua)) nav = 'Firefox';
    else if (/Safari\//.test(ua)) nav = 'Safari';
    if (/Windows/.test(ua)) os = 'Windows';
    else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';
    return os ? nav + ' · ' + os : nav;
  }

  function cell(text, cls, label) {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    if (label) td.dataset.label = label;
    td.textContent = (text == null || text === '') ? '—' : text;
    return td;
  }

  function render(filas) {
    const body = $('bita-body');
    body.innerHTML = '';
    if (!filas || !filas.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7; td.className = 'bita-empty';
      td.textContent = 'Sin registros para los filtros seleccionados.';
      tr.appendChild(td); body.appendChild(tr);
      $('bita-count').textContent = '';
      return;
    }
    filas.forEach((f) => {
      const tr = document.createElement('tr');
      tr.appendChild(cell(fmtFecha(f.fecha), 'bita-fecha', 'Fecha y hora'));
      tr.appendChild(cell(f.usuario, 'bita-strong', 'Usuario'));
      tr.appendChild(cell(f.nombre, '', 'Nombre'));
      tr.appendChild(cell(f.rol, '', 'Rol'));

      const meta = EVENTO[f.evento] || { txt: f.evento, cls: 'neu', icon: 'fa-circle' };
      const tdE = document.createElement('td');
      tdE.dataset.label = 'Evento';
      const badge = document.createElement('span');
      badge.className = 'bita-badge bita-badge--' + ((f.evento === 'login_fallido' || !f.exito) ? 'bad' : meta.cls);
      const ic = document.createElement('i');
      ic.className = 'fas ' + meta.icon;
      badge.appendChild(ic);
      badge.appendChild(document.createTextNode(' ' + meta.txt));
      tdE.appendChild(badge);
      tr.appendChild(tdE);

      tr.appendChild(cell(f.ip, 'bita-ip', 'IP'));

      const tdUA = cell(simplificaUA(f.user_agent), 'bita-ua', 'Navegador');
      if (f.user_agent) tdUA.title = f.user_agent;
      tr.appendChild(tdUA);

      body.appendChild(tr);
    });
    $('bita-count').textContent = filas.length + (filas.length === 1 ? ' registro' : ' registros');
    applyBitaCards();
  }

  // Tarjetas solo cuando la tabla no entra (scroll horizontal) en móvil.
  function applyBitaCards() {
    const wrap = document.querySelector('.bita-tablewrap');
    const table = wrap && wrap.querySelector('.bita-table');
    if (!wrap || !table) return;
    wrap.classList.remove('crud-cards');
    const narrow = window.matchMedia('(max-width: 768px)').matches;
    const overflowing = table.scrollWidth > wrap.clientWidth + 1;
    if (narrow && overflowing) wrap.classList.add('crud-cards');
  }
  if (!window.__bitaCardsResize) {
    window.__bitaCardsResize = true;
    let _bitaT;
    window.addEventListener('resize', function () {
      clearTimeout(_bitaT);
      _bitaT = setTimeout(applyBitaCards, 150);
    });
  }

  function buildParams() {
    const p = new URLSearchParams();
    const q  = $('f-q').value.trim();
    const ev = $('f-evento').value;
    const ex = $('f-exito').value;
    const de = $('f-desde').value;
    const ha = $('f-hasta').value;
    if (q)  p.set('q', q);
    if (ev) p.set('evento', ev);
    if (ex) p.set('exito', ex);
    if (de) p.set('desde', de);
    if (ha) p.set('hasta', ha);
    p.set('limit', '500');
    return p.toString();
  }

  // Coloca una fila de estado (carga/error) ocupando toda la tabla.
  function estadoFila() {
    const body = $('bita-body');
    body.innerHTML = '<tr><td colspan="7" id="bita-estado"></td></tr>';
    return $('bita-estado');
  }

  async function cargar() {
    const msg = $('bita-msg');
    msg.hidden = true;
    if (window.UIState) { UIState.loading(estadoFila(), 'Cargando…'); $('bita-count').textContent = ''; }
    try {
      const r = await fetch('/api/bitacora?' + buildParams(), { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      render(data.filas || []);
    } catch (e) {
      $('bita-count').textContent = '';
      if (window.UIState) {
        UIState.error(estadoFila(), 'No se pudo cargar la bitácora.', cargar);
      } else {
        msg.hidden = false;
        msg.textContent = 'No se pudo cargar la bitácora.';
        $('bita-body').innerHTML = '<tr><td colspan="7" class="bita-empty">Error al cargar.</td></tr>';
      }
    }
  }

  function debounced() { clearTimeout(timer); timer = setTimeout(cargar, 300); }

  document.addEventListener('DOMContentLoaded', () => {
    $('f-q').addEventListener('input', debounced);
    ['f-evento', 'f-exito', 'f-desde', 'f-hasta'].forEach((id) => $(id).addEventListener('change', cargar));
    $('bita-refrescar').addEventListener('click', cargar);
    $('bita-limpiar').addEventListener('click', () => {
      ['f-q', 'f-evento', 'f-exito', 'f-desde', 'f-hasta'].forEach((id) => { $(id).value = ''; });
      cargar();
    });
    cargar();
  });
})();

