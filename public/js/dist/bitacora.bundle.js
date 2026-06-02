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
/* ===== multiselect.js ===== */
/* multiselect.js
   Convierte los <select> de los filtros del CRUD en un dropdown diseñado.
   - <select multiple>  -> checklist (varias opciones)
   - <select> simple    -> lista de selección única
   Mantiene el <select> nativo (oculto) como fuente de datos, así la lógica
   existente (value / selectedOptions / change) sigue funcionando igual. */

(function () {
  const filtersEl = document.getElementById('filters');

  function closeOthers(except) {
    document.querySelectorAll('.ms.is-open').forEach((ms) => {
      if (ms !== except) close(ms);
    });
  }
  document.addEventListener('click', () => closeOthers(null));

  function close(ms) {
    ms.classList.remove('is-open');
    ms._panel.classList.add('hidden');
    if (ms._flotante) {
      const p = ms._panel;
      p.style.position = ''; p.style.left = ''; p.style.top = '';
      p.style.width = ''; p.style.minWidth = ''; p.style.maxWidth = ''; p.style.right = ''; p.style.zIndex = '';
      window.removeEventListener('scroll', ms._onScroll, true);
      window.removeEventListener('resize', ms._onScroll);
      ms._flotante = false;
    }
  }

  // Posiciona el panel como flotante (fixed) para que el modal no lo recorte
  // ni genere scroll: el desplegable simplemente se sobrepone.
  function posicionarFlotante(ms) {
    const r = ms._btn.getBoundingClientRect();
    const p = ms._panel;
    p.style.position = 'fixed';
    p.style.top = (r.bottom + 6) + 'px';
    p.style.right = 'auto';
    p.style.zIndex = '2000';
    // El panel se ajusta al contenido (para que el texto se vea completo),
    // pero al menos tan ancho como el botón y sin pasar de 90vw.
    p.style.minWidth = r.width + 'px';
    p.style.width = 'max-content';
    p.style.maxWidth = '90vw';
    // Calcular 'left' evitando que se salga por el borde derecho.
    p.style.left = r.left + 'px';
    const pw = p.offsetWidth;
    let left = r.left;
    if (left + pw > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - pw - 8);
    }
    p.style.left = left + 'px';
    ms._flotante = true;
  }

  function updateLabel(ms) {
    const select = ms._select;
    const label = ms._label;
    if (select.multiple) {
      const chosen = Array.from(select.options).filter((o) => o.selected && o.value !== '');
      if (chosen.length === 0) { label.textContent = ms._placeholder; label.classList.add('is-placeholder'); }
      else if (chosen.length === 1) { label.textContent = chosen[0].textContent; label.classList.remove('is-placeholder'); }
      else { label.textContent = chosen.length + ' seleccionadas'; label.classList.remove('is-placeholder'); }
    } else {
      const sel = select.options[select.selectedIndex];
      if (!sel || sel.value === '') { label.textContent = ms._placeholder; label.classList.add('is-placeholder'); }
      else { label.textContent = sel.textContent; label.classList.remove('is-placeholder'); }
    }
  }

  function applyStored(select) {
    if (select._userDirty) return;
    const stored = (window.appliedFilters && window.appliedFilters[select.id]) || null;
    if (!stored || !stored.length) return;
    if (select.multiple) {
      Array.from(select.options).forEach((o) => {
        if (o.value !== '' && stored.includes(o.value)) o.selected = true;
      });
    } else {
      const match = stored.find((v) => v !== '');
      if (match != null && Array.from(select.options).some((o) => o.value === match)) {
        select.value = match;
      }
    }
  }

  function buildList(ms) {
    const select = ms._select;
    applyStored(select);
    const list = ms._list;
    list.innerHTML = '';
    const multi = select.multiple;

    const allOpts = multi
      ? Array.from(select.options).filter((o) => o.value !== '')
      : Array.from(select.options);

    ms._search.style.display = (allOpts.length > 7) ? '' : 'none';

    if (!allOpts.length) {
      const e = document.createElement('div');
      e.className = 'ms__empty';
      e.textContent = 'Sin opciones';
      list.appendChild(e);
      return;
    }

    function renderOption(o, container) {
      if (multi) {
        if (o.value === '') return;
        const lab = document.createElement('label');
        lab.className = 'ms__opt';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = o.value;
        cb.checked = o.selected;
        const sp = document.createElement('span');
        sp.textContent = o.textContent;
        cb.addEventListener('change', () => {
          select._userDirty = true;
          o.selected = cb.checked;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          updateLabel(ms);
        });
        lab.appendChild(cb);
        lab.appendChild(sp);
        container.appendChild(lab);
      } else {
        const row = document.createElement('div');
        row.className = 'ms__opt ms__opt--single';
        if (o.selected && o.value !== '') row.classList.add('is-selected');
        if (o.value === '') row.classList.add('ms__opt--reset');
        const sp = document.createElement('span');
        sp.textContent = o.value === '' ? (o.textContent || 'Todas') : o.textContent;
        const chk = document.createElement('i');
        chk.className = 'fas fa-check ms__check';
        row.appendChild(sp);
        row.appendChild(chk);
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          select._userDirty = true;
          select.value = o.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          updateLabel(ms);
          buildList(ms);
          close(ms);
        });
        container.appendChild(row);
      }
    }

    // Recorre hijos del select preservando los grupos (optgroup -> encabezado)
    Array.from(select.children).forEach((node) => {
      if (node.tagName === 'OPTGROUP') {
        const wrap = document.createElement('div');
        wrap.className = 'ms__groupwrap';
        const head = document.createElement('div');
        head.className = 'ms__group';
        head.textContent = node.label;
        wrap.appendChild(head);
        Array.from(node.children).forEach((o) => renderOption(o, wrap));
        list.appendChild(wrap);
      } else if (node.tagName === 'OPTION') {
        renderOption(node, list);
      }
    });
  }

  function enhance(select) {
    if (!select._ms) {
      const ph = (select.options[0] && select.options[0].value === '')
        ? select.options[0].textContent
        : 'Seleccionar';

      const ms = document.createElement('div');
      ms.className = 'ms';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ms__btn';
      const label = document.createElement('span');
      label.className = 'ms__label is-placeholder';
      label.textContent = ph;
      const caret = document.createElement('i');
      caret.className = 'fas fa-chevron-down ms__caret';
      btn.appendChild(label);
      btn.appendChild(caret);

      const panel = document.createElement('div');
      panel.className = 'ms__panel hidden';
      const search = document.createElement('div');
      search.className = 'ms__search';
      const sin = document.createElement('input');
      sin.type = 'text';
      sin.placeholder = 'Buscar…';
      search.appendChild(sin);
      const list = document.createElement('div');
      list.className = 'ms__list';
      panel.appendChild(search);
      panel.appendChild(list);

      if (select.multiple) {
        const foot = document.createElement('div');
        foot.className = 'ms__foot';
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = 'Limpiar selección';
        clear.addEventListener('click', (e) => {
          e.stopPropagation();
          select._userDirty = true;
          Array.from(select.options).forEach((o) => (o.selected = false));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          buildList(ms);
          updateLabel(ms);
        });
        foot.appendChild(clear);
        panel.appendChild(foot);
      }

      ms.appendChild(btn);
      ms.appendChild(panel);

      select.style.display = 'none';
      select.insertAdjacentElement('afterend', ms);

      select._ms = ms;
      ms._select = select;
      ms._label = label;
      ms._list = list;
      ms._panel = panel;
      ms._search = search;
      ms._placeholder = ph;
      ms._btn = btn;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !ms.classList.contains('is-open');
        closeOthers(ms);
        if (willOpen) {
          ms.classList.add('is-open');
          panel.classList.remove('hidden');
          if (ms.closest('.modal-container')) {
            posicionarFlotante(ms);
            ms._onScroll = () => close(ms);
            window.addEventListener('scroll', ms._onScroll, true);
            window.addEventListener('resize', ms._onScroll);
          }
          if (search.style.display !== 'none') sin.focus();
        } else {
          close(ms);
        }
      });
      panel.addEventListener('click', (e) => e.stopPropagation());
      sin.addEventListener('input', () => {
        const q = sin.value.toLowerCase();
        list.querySelectorAll('.ms__opt').forEach((l) => {
          l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
        list.querySelectorAll('.ms__groupwrap').forEach((w) => {
          const any = Array.from(w.querySelectorAll('.ms__opt')).some((o) => o.style.display !== 'none');
          w.style.display = any ? '' : 'none';
        });
      });
    }
    buildList(select._ms);
    updateLabel(select._ms);
  }

  // Exponer para reutilizar el dropdown diseñado fuera de los filtros (ej. el
  // <select> de rol en el modal de usuarios).
  window.enhanceSelect = enhance;

  if (filtersEl) {
    let pending = false;
    const obs = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        obs.disconnect();
        filtersEl.querySelectorAll('select').forEach(enhance);
        obs.observe(filtersEl, { childList: true, subtree: true });
      });
    });
    obs.observe(filtersEl, { childList: true, subtree: true });
    filtersEl.querySelectorAll('select').forEach(enhance);
  }
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

  // Aplica el dropdown diseñado de la app a los <select> de filtro.
  function enhanceFiltros() {
    if (!window.enhanceSelect) return;
    ['f-evento', 'f-exito'].forEach((id) => { const el = $(id); if (el) window.enhanceSelect(el); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('f-q').addEventListener('input', debounced);
    ['f-evento', 'f-exito', 'f-desde', 'f-hasta'].forEach((id) => $(id).addEventListener('change', cargar));
    $('bita-refrescar').addEventListener('click', cargar);
    $('bita-limpiar').addEventListener('click', () => {
      ['f-q', 'f-evento', 'f-exito', 'f-desde', 'f-hasta'].forEach((id) => { $(id).value = ''; });
      enhanceFiltros(); // refresca las etiquetas de los dropdowns diseñados
      cargar();
    });
    enhanceFiltros();
    cargar();
  });
})();

