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
/* ===== dashboard.js ===== */
(function () {
  'use strict';

  function css(varName, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    return (v && v.trim()) || fallback;
  }

  var COL_TEXT = css('--text-muted', '#5b6661');
  var COL_GRID = css('--border', '#e3e7e5');
  var GREEN    = '#12876a';
  var AMBER    = '#BA7517';

  if (window.Chart) {
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.color = COL_TEXT;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
  }

  // Contexto 2D del canvas; destruye antes cualquier gráfico ya existente en él
  // para que "Reintentar" no falle con "Canvas is already in use".
  function ctx(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (window.Chart && Chart.getChart) {
      var ex = Chart.getChart(el);
      if (ex) ex.destroy();
    }
    return el.getContext('2d');
  }

  function doughnut(id, labels, data, colors) {
    var c = ctx(id); if (!c) return;
    new Chart(c, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  function n(v) { return (v == null ? 0 : v).toLocaleString('es-CL'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function iconAccion(accion) {
    var a = (accion || '').toLowerCase();
    if (a.indexOf('crea') !== -1) return 'fa-plus';
    if (a.indexOf('edit') !== -1 || a.indexOf('actualiz') !== -1) return 'fa-edit';
    if (a.indexOf('elimin') !== -1 || a.indexOf('borr') !== -1) return 'fa-trash';
    return 'fa-circle';
  }

  function fetchJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { if (!r.ok) throw { status: r.status }; return r.json(); });
  }

  // Helper de estados (definido en /js/estados.js). Fallback inocuo por si falta.
  var UI = window.UIState || { loading: function () {}, empty: function () {}, error: function () {}, hide: function () {} };
  function statusNode(id) { return document.getElementById(id); }

  // =========================================================================
  //  Información general (cross-filter de parcelas)
  // =========================================================================
  var RAW = [];
  var filtro = { dim: null, val: null };
  var charts = {};
  var DIM_CHART = { cultivo: 'chart-cultivo', region: 'chart-region', fase: 'chart-fase' };
  var DIM_NOMBRE = { cultivo: 'Cultivo', region: 'Región', fase: 'Fase' };

  function agrupar(rows, campo) {
    var m = {};
    rows.forEach(function (r) { var k = r[campo] || '—'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { etiqueta: k, valor: m[k] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
  }
  function agruparMes(rows) {
    var m = {};
    rows.forEach(function (r) { var k = r.mes || '—'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort().map(function (k) { return { etiqueta: k, valor: m[k] }; });
  }
  function filtradas() {
    if (!filtro.dim) return RAW;
    return RAW.filter(function (r) { return (r[filtro.dim] || '—') === filtro.val; });
  }
  function barInteractivo(dim, id) {
    var c = ctx(id); if (!c) return null;
    var ch = new Chart(c, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 6, maxBarThickness: 38 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        onHover: function (e, els) { if (e.native) e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
        onClick: function (evt, els) {
          if (!els.length) return;
          var label = ch.data.labels[els[0].index];
          if (filtro.dim === dim && filtro.val === label) filtro = { dim: null, val: null };
          else filtro = { dim: dim, val: label };
          render();
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COL_TEXT } },
          y: { beginAtZero: true, grid: { color: COL_GRID }, ticks: { precision: 0, color: COL_TEXT } }
        }
      }
    });
    return ch;
  }
  function lineSimple(id) {
    var c = ctx(id); if (!c) return null;
    return new Chart(c, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: GREEN, backgroundColor: 'rgba(18,135,106,0.12)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: GREEN }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: COL_TEXT } },
          y: { beginAtZero: true, grid: { color: COL_GRID }, ticks: { precision: 0, color: COL_TEXT } }
        }
      }
    });
  }
  function pintarBarras(ch, dim, rows) {
    var labels = rows.map(function (r) { return r.etiqueta; });
    ch.data.labels = labels;
    ch.data.datasets[0].data = rows.map(function (r) { return r.valor; });
    ch.data.datasets[0].backgroundColor = labels.map(function (lab) {
      if (filtro.dim === dim) return (lab === filtro.val) ? GREEN : 'rgba(18,135,106,0.26)';
      return GREEN;
    });
    ch.update();
  }
  function pintarChip() {
    var chip = document.getElementById('dash-filtro');
    if (!chip) return;
    if (!filtro.dim) { chip.innerHTML = ''; chip.style.display = 'none'; return; }
    chip.style.display = '';
    chip.innerHTML = '<i class="fas fa-filter"></i> ' + (DIM_NOMBRE[filtro.dim] || filtro.dim) +
      ': <b>' + esc(filtro.val) + '</b> <button id="dash-filtro-x" title="Quitar filtro">&times;</button>';
    var x = document.getElementById('dash-filtro-x');
    if (x) x.addEventListener('click', function () { filtro = { dim: null, val: null }; render(); });
  }
  function render() {
    var fil = filtradas();
    Object.keys(DIM_CHART).forEach(function (dim) {
      var ch = charts[dim]; if (!ch) return;
      var base = (filtro.dim === dim) ? RAW : fil;
      pintarBarras(ch, dim, agrupar(base, dim));
    });
    if (charts.mes) {
      var rm = agruparMes(fil);
      charts.mes.data.labels = rm.map(function (r) { return r.etiqueta; });
      charts.mes.data.datasets[0].data = rm.map(function (r) { return r.valor; });
      charts.mes.update();
    }
    var kp = document.getElementById('kpi-parcelaciones');
    if (kp) kp.innerHTML = n(fil.length);
    pintarChip();
  }

  function pintarResumen(d) {
    var k = d.kpis || {};
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; };
    set('kpi-cuarentenas', n(k.cuarentenas_activas) + ' <small>de ' + n(k.cuarentenas_total) + '</small>');
    set('kpi-cultivos', n(k.cultivos_total));
    set('kpi-comunas', n(k.sectores_total));

    var activas = k.cuarentenas_activas || 0;
    var inactivas = Math.max((k.cuarentenas_total || 0) - activas, 0);
    doughnut('chart-cuarentenas', ['Activas', 'Inactivas'], [activas, inactivas], ['#D85A30', '#B4B2A9']);

    var actEl = document.getElementById('dash-actividad');
    if (actEl) {
      var act = d.actividad || [];
      if (!act.length) { actEl.innerHTML = '<div class="dash-empty">Sin actividad registrada.</div>'; }
      else {
        actEl.innerHTML = act.map(function (a) {
          return '<div class="dash-list__row"><span><i class="fas ' + iconAccion(a.accion) + '"></i>' +
            (a.accion || 'Acción') + (a.nombre ? ' · ' + a.nombre : '') + '</span>' +
            '<span class="dash-muted">' + (a.fecha || '') + '</span></div>';
        }).join('');
      }
    }
  }

  function pintarParcelasRaw(d) {
    RAW = d.parcelas || [];
    filtro = { dim: null, val: null };
    charts.cultivo = barInteractivo('cultivo', 'chart-cultivo');
    charts.region = barInteractivo('region', 'chart-region');
    charts.fase = barInteractivo('fase', 'chart-fase');
    charts.mes = lineSimple('chart-mes');
    render();
  }

  function cargarGeneral() {
    var node = statusNode('general-status');
    UI.loading(node, 'Cargando datos…');
    return Promise.all([
      fetchJSON('/api/dashboard/resumen'),
      fetchJSON('/api/dashboard/parcelas-raw')
    ]).then(function (res) {
      pintarResumen(res[0]);
      pintarParcelasRaw(res[1]);
      UI.hide(node);
    }).catch(function (e) {
      console.error('Error cargando información general:', e);
      UI.error(node, 'No se pudieron cargar los datos generales.', cargarGeneral);
    });
  }

  // =========================================================================
  //  Administrador (cross-filter rol / tema)
  // =========================================================================
  function pintarAdmin(d) {
    var k = d.kpis || {};
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('adm-roles', n(k.roles_total)); // catálogo de roles (no reactivo)

    var RAWU = d.usuariosRaw || [];
    var fU = { dim: null, val: null };
    var chRol = null, chTema = null;

    function temaKey(t) { return (String(t || '').toLowerCase() === 'dark') ? 'dark' : 'light'; }
    function filU() {
      if (!fU.dim) return RAWU;
      return RAWU.filter(function (u) {
        return (fU.dim === 'tema' ? temaKey(u.tema) : (u[fU.dim] || '—')) === fU.val;
      });
    }
    function agruparRol(rows) {
      var m = {};
      rows.forEach(function (u) { var key = u.rol || '—'; m[key] = (m[key] || 0) + 1; });
      return Object.keys(m).map(function (key) { return { etiqueta: key, valor: m[key] }; })
        .sort(function (a, b) { return b.valor - a.valor; });
    }
    function temaCounts(rows) {
      var dark = 0, light = 0;
      rows.forEach(function (u) { if (temaKey(u.tema) === 'dark') dark++; else light++; });
      return [dark, light];
    }
    function pintarChipU() {
      var wrap = document.getElementById('adm-filtro-wrap');
      var chip = document.getElementById('adm-filtro');
      if (!wrap || !chip) return;
      if (!fU.dim) { wrap.style.display = 'none'; chip.innerHTML = ''; return; }
      var nombre = (fU.dim === 'rol') ? 'Rol' : 'Tema';
      var valor = (fU.dim === 'tema') ? (fU.val === 'dark' ? 'Oscuro' : 'Claro') : fU.val;
      wrap.style.display = '';
      chip.innerHTML = '<i class="fas fa-filter"></i> ' + nombre + ': <b>' + esc(valor) + '</b> <button id="adm-filtro-x" title="Quitar filtro">&times;</button>';
      var x = document.getElementById('adm-filtro-x');
      if (x) x.addEventListener('click', function () { fU = { dim: null, val: null }; renderU(); });
    }
    function renderU() {
      var fil = filU();
      if (chRol) {
        var rolRows = agruparRol(fU.dim === 'rol' ? RAWU : fil);
        chRol.data.labels = rolRows.map(function (r) { return r.etiqueta; });
        chRol.data.datasets[0].data = rolRows.map(function (r) { return r.valor; });
        chRol.data.datasets[0].backgroundColor = chRol.data.labels.map(function (lab) {
          if (fU.dim === 'rol') return (lab === fU.val) ? AMBER : 'rgba(186,117,23,0.28)';
          return AMBER;
        });
        chRol.update();
      }
      if (chTema) {
        chTema.data.datasets[0].data = temaCounts(fU.dim === 'tema' ? RAWU : fil);
        chTema.data.datasets[0].backgroundColor = ['#0f6e56', '#9FE1CB'].map(function (col, i) {
          if (fU.dim === 'tema') {
            var key = (i === 0) ? 'dark' : 'light';
            return (key === fU.val) ? col : 'rgba(150,150,150,0.25)';
          }
          return col;
        });
        chTema.update();
      }
      set('adm-usuarios', n(fil.length));
      set('adm-oscuro', n(temaCounts(fil)[0]));
      pintarChipU();
    }

    var cR = ctx('chart-rol');
    if (cR) {
      chRol = new Chart(cR, {
        type: 'bar',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 6, maxBarThickness: 38 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          onHover: function (e, els) { if (e.native) e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
          onClick: function (evt, els) {
            if (!els.length) return;
            var label = chRol.data.labels[els[0].index];
            if (fU.dim === 'rol' && fU.val === label) fU = { dim: null, val: null };
            else fU = { dim: 'rol', val: label };
            renderU();
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: COL_TEXT } },
            y: { beginAtZero: true, grid: { color: COL_GRID }, ticks: { precision: 0, color: COL_TEXT } }
          }
        }
      });
    }
    var cT = ctx('chart-tema');
    if (cT) {
      chTema = new Chart(cT, {
        type: 'doughnut',
        data: { labels: ['Oscuro', 'Claro'], datasets: [{ data: [0, 0], backgroundColor: ['#0f6e56', '#9FE1CB'], borderWidth: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: { legend: { position: 'bottom' } },
          onHover: function (e, els) { if (e.native) e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
          onClick: function (evt, els) {
            if (!els.length) return;
            var key = (els[0].index === 0) ? 'dark' : 'light';
            if (fU.dim === 'tema' && fU.val === key) fU = { dim: null, val: null };
            else fU = { dim: 'tema', val: key };
            renderU();
          }
        }
      });
    }

    renderU();

    var ult = document.getElementById('adm-ultimos');
    if (ult) {
      var rows = d.ultimos || [];
      if (!rows.length) { ult.innerHTML = '<div class="dash-empty">Sin usuarios.</div>'; }
      else {
        ult.innerHTML = rows.map(function (u) {
          var nombre = ((u.nombre || '') + ' ' + (u.apellido || '')).trim() || u.usuario;
          return '<div class="dash-list__row"><span>' + nombre + '</span>' +
            '<span class="dash-muted">' + (u.rol || '') + '</span></div>';
        }).join('');
      }
    }
  }

  function cargarAdmin() {
    var sec = document.getElementById('dash-admin');
    if (!sec) return Promise.resolve();
    var node = statusNode('admin-status');
    UI.loading(node, 'Cargando…');
    return fetchJSON('/api/dashboard/usuarios').then(function (d) {
      pintarAdmin(d);
      UI.hide(node);
    }).catch(function (e) {
      if (e && e.status === 403) { sec.style.display = 'none'; return; }
      console.error('Error cargando estadísticas de usuarios:', e);
      UI.error(node, 'No se pudieron cargar las estadísticas de usuarios.', cargarAdmin);
    });
  }

  // =========================================================================
  //  Accesos al sistema
  // =========================================================================
  var EVT = {
    login:         { t: 'Ingreso',          i: 'fa-sign-in-alt' },
    logout:        { t: 'Cierre de sesión', i: 'fa-sign-out-alt' },
    login_fallido: { t: 'Intento fallido',  i: 'fa-exclamation-triangle' }
  };
  function fechaCorta(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function pintarAccesos(d) {
    var k = d.kpis || {};
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    set('acc-hoy', n(k.ingresos_hoy));
    set('acc-usuarios', n(k.usuarios_hoy));
    set('acc-fallidos', n(k.fallidos_7d));
    set('acc-total', n(k.total));

    var ul = document.getElementById('acc-ultimos');
    if (ul) {
      var rows = d.ultimos || [];
      if (!rows.length) { ul.innerHTML = '<div class="dash-empty">Sin accesos registrados.</div>'; }
      else {
        ul.innerHTML = rows.map(function (a) {
          var m = EVT[a.evento] || { t: a.evento, i: 'fa-circle' };
          var who = esc(a.nombre || a.usuario || '—');
          var bad = (a.evento === 'login_fallido' || !a.exito);
          return '<div class="dash-list__row"><span' + (bad ? ' class="dash-acc--bad"' : '') + '>' +
            '<i class="fas ' + m.i + '"></i>' + who +
            ' <span class="dash-muted">· ' + esc(m.t) + (a.rol ? ' · ' + esc(a.rol) : '') + '</span></span>' +
            '<span class="dash-muted">' + esc(fechaCorta(a.fecha)) + '</span></div>';
        }).join('');
      }
    }
  }
  function cargarAccesos() {
    var sec = document.getElementById('dash-accesos');
    if (!sec) return Promise.resolve();
    var node = statusNode('accesos-status');
    UI.loading(node, 'Cargando…');
    return fetchJSON('/api/bitacora/resumen').then(function (d) {
      pintarAccesos(d);
      UI.hide(node);
    }).catch(function (e) {
      if (e && e.status === 403) { sec.style.display = 'none'; return; }
      console.error('Error cargando accesos:', e);
      UI.error(node, 'No se pudieron cargar los accesos.', cargarAccesos);
    });
  }

  // ---- Arranque ----
  cargarGeneral();
  cargarAdmin();
  cargarAccesos();

  // Fecha en el encabezado
  var f = document.getElementById('dash-fecha');
  if (f) {
    try { f.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { f.textContent = new Date().toLocaleDateString(); }
  }
})();

;
/* ===== reportes.js ===== */
// Exportaciones del Dashboard:
//  - PDF: "fotografía" del panel operativo (excluye Administrador y Accesos).
//  - Excel: registros de parcelas y cuarentenas (los que el rol puede ver).
// Las librerías pesadas se cargan solo cuando el usuario pulsa exportar.
(function () {
  const URL_XLSX  = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const URL_H2C   = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  const URL_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-rsrc="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.dataset.rsrc = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar la librería de exportación.'));
      document.head.appendChild(s);
    });
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
      btn.dataset.txt = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando…';
    } else if (btn.dataset.txt) {
      btn.innerHTML = btn.dataset.txt;
    }
  }

  function aviso(msg) { (window.notify ? window.notify(msg) : alert(msg)); }

  // ---- Excel: registros de parcelas y cuarentenas ----
  async function exportarExcel(btn) {
    try {
      setBusy(btn, true);
      const resp = await fetch('/reportes/datos');
      if (!resp.ok) throw new Error('Error ' + resp.status);
      const data = await resp.json();

      await cargarScript(URL_XLSX);
      const wb = XLSX.utils.book_new();
      if (Array.isArray(data.parcelas) && data.parcelas.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.parcelas), 'Parcelas');
      }
      if (Array.isArray(data.cuarentenas) && data.cuarentenas.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.cuarentenas), 'Cuarentenas');
      }
      if (!wb.SheetNames.length) { aviso('No hay registros para exportar.'); return; }

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `registros_landmosaic_${fecha}.xlsx`);
    } catch (e) {
      aviso('No se pudo exportar a Excel: ' + e.message);
    } finally {
      setBusy(btn, false);
    }
  }

  // ---- PDF: foto del panel operativo (sin Administrador ni Accesos) ----
  async function exportarPDF(btn) {
    try {
      setBusy(btn, true);
      await cargarScript(URL_H2C);
      await cargarScript(URL_JSPDF);

      const cont = document.querySelector('.dash-wrap') || document.querySelector('.dash');
      if (!cont) throw new Error('No se encontró el panel.');

      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
      const canvas = await html2canvas(cont, {
        scale: 2,
        backgroundColor: bg,
        useCORS: true,
        // Excluir secciones con datos de usuarios/accesos y los propios botones
        ignoreElements: (el) =>
          el.id === 'dash-admin' || el.id === 'dash-accesos' || el.classList.contains('reportes-actions')
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgW = pw;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL('image/png');

      let heightLeft = imgH;
      let pos = 0;
      pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        pos -= ph;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
        heightLeft -= ph;
      }

      const fecha = new Date().toISOString().slice(0, 10);
      pdf.save(`dashboard_landmosaic_${fecha}.pdf`);
    } catch (e) {
      aviso('No se pudo exportar a PDF: ' + e.message);
    } finally {
      setBusy(btn, false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const bExcel = document.getElementById('btn-export-excel');
    const bPdf = document.getElementById('btn-export-pdf');
    if (bExcel) bExcel.addEventListener('click', () => exportarExcel(bExcel));
    if (bPdf) bPdf.addEventListener('click', () => exportarPDF(bPdf));
  });
})();

