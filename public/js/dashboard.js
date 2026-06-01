(function () {
  'use strict';

  function css(varName, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    return (v && v.trim()) || fallback;
  }

  var COL_TEXT  = css('--text-muted', '#5b6661');
  var COL_GRID  = css('--border', '#e3e7e5');
  var GREEN     = '#12876a';
  var GREENS    = ['#0f6e56', '#12876a', '#1D9E75', '#5dcaa5', '#97C459', '#639922', '#3B6D11'];
  var AMBER     = '#BA7517';

  if (window.Chart) {
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.color = COL_TEXT;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
  }

  function ctx(id) {
    var el = document.getElementById(id);
    return el ? el.getContext('2d') : null;
  }

  function barChart(id, rows, color) {
    var c = ctx(id); if (!c) return;
    new Chart(c, {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.etiqueta; }),
        datasets: [{ data: rows.map(function (r) { return r.valor; }), backgroundColor: color || GREEN, borderRadius: 6, maxBarThickness: 38 }]
      },
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

  function lineChart(id, rows) {
    var c = ctx(id); if (!c) return;
    new Chart(c, {
      type: 'line',
      data: {
        labels: rows.map(function (r) { return r.etiqueta; }),
        datasets: [{
          data: rows.map(function (r) { return r.valor; }),
          borderColor: GREEN, backgroundColor: 'rgba(18,135,106,0.12)',
          fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: GREEN
        }]
      },
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

  function n(v) { return (v == null ? 0 : v).toLocaleString('es-CL'); }

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

  // ---- Resumen general (todos) ----
  fetchJSON('/api/dashboard/resumen').then(function (d) {
    var k = d.kpis || {};
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; };
    set('kpi-parcelaciones', n(k.parcelaciones_total));
    set('kpi-cuarentenas', n(k.cuarentenas_activas) + ' <small>de ' + n(k.cuarentenas_total) + '</small>');
    set('kpi-cultivos', n(k.cultivos_total));
    set('kpi-comunas', n(k.sectores_total));

    barChart('chart-cultivo', d.porCultivo || [], GREEN);
    barChart('chart-region', d.porRegion || [], GREEN);
    barChart('chart-fase', d.porFase || [], GREEN);
    lineChart('chart-mes', d.porMes || []);

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
  }).catch(function (e) {
    console.error('Error cargando resumen del dashboard:', e);
  });

  // ---- Estadísticas de usuarios (solo administrador) ----
  if (document.getElementById('dash-admin')) {
    fetchJSON('/api/dashboard/usuarios').then(function (d) {
      var k = d.kpis || {};
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      set('adm-usuarios', n(k.usuarios_total));
      set('adm-roles', n(k.roles_total));
      set('adm-oscuro', n(k.tema_oscuro));

      barChart('chart-rol', d.porRol || [], AMBER);

      var temas = d.porTema || [];
      var oscuro = 0, claro = 0;
      temas.forEach(function (t) {
        if ((t.etiqueta || '').toLowerCase() === 'dark') oscuro += t.valor; else claro += t.valor;
      });
      doughnut('chart-tema', ['Oscuro', 'Claro'], [oscuro, claro], ['#0f6e56', '#9FE1CB']);

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
    }).catch(function (e) {
      // Si por algún motivo no es admin (403), oculta la sección sin romper la página.
      if (e && e.status === 403) {
        var adm = document.getElementById('dash-admin');
        if (adm) adm.style.display = 'none';
      } else {
        console.error('Error cargando estadísticas de usuarios:', e);
      }
    });
  }

  // Fecha en el encabezado
  var f = document.getElementById('dash-fecha');
  if (f) {
    try { f.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch (e) { f.textContent = new Date().toLocaleDateString(); }
  }
})();
