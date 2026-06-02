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
