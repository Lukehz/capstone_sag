/* roles.js — Gestión de roles (cliente).
   Arma la matriz apartado x nivel y las capacidades a partir de los catálogos,
   y permite crear, editar y eliminar roles vía /api/rol. */
(function () {
  const $ = (id) => document.getElementById(id);
  const api = '/api/rol';
  let CAT = { apartados: [], niveles: [], capacidades: [] };
  let editId = null;        // null = crear, número = editar
  let rolesCache = [];

  const NIVEL_LABEL = { N: 'Sin acceso', L: 'Ver', A: 'Ver + editar' };

  async function jget(url) {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).error) || ('Error ' + r.status));
    return r.json();
  }
  async function jsend(url, method, body) {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('Error ' + r.status));
    return data;
  }

  function msg(text, tipo) {
    const el = $('rol-msg');
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = text;
    el.className = 'roles-msg ' + (tipo === 'error' ? 'is-error' : 'is-ok');
    if (tipo !== 'error') setTimeout(() => { el.hidden = true; }, 3000);
  }

  function renderMatrix(sel) {
    const cont = $('rol-matrix');
    cont.innerHTML = '';
    CAT.apartados.forEach((ap) => {
      const cur = (sel && sel[ap.codigo]) || 'N';
      const row = document.createElement('div');
      row.className = 'roles-row';
      const name = document.createElement('span');
      name.className = 'roles-apt';
      name.textContent = ap.nombre;
      row.appendChild(name);
      const seg = document.createElement('div');
      seg.className = 'roles-seg';
      const niveles = ap.solo_lectura ? ['N', 'L'] : ['N', 'L', 'A'];
      const cur2 = (ap.solo_lectura && cur === 'A') ? 'L' : cur;
      if (ap.solo_lectura) seg.classList.add('roles-seg--ro');
      niveles.forEach((niv) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = NIVEL_LABEL[niv];
        b.className = 'roles-seg__opt' + (niv === cur2 ? ' on' : '');
        b.dataset.ap = ap.codigo;
        b.dataset.niv = niv;
        b.addEventListener('click', () => {
          seg.querySelectorAll('.roles-seg__opt').forEach((x) => x.classList.toggle('on', x === b));
        });
        seg.appendChild(b);
      });
      row.appendChild(seg);
      cont.appendChild(row);
    });
  }

  function renderCaps(sel) {
    const cont = $('rol-caps');
    cont.innerHTML = '';
    CAT.capacidades.forEach((cap) => {
      const lbl = document.createElement('label');
      lbl.className = 'roles-chk';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = cap.codigo;
      chk.checked = !!(sel && sel.includes(cap.codigo));
      lbl.appendChild(chk);
      const span = document.createElement('span');
      span.textContent = cap.nombre;
      lbl.appendChild(span);
      cont.appendChild(lbl);
    });
  }

  function getMatrixValues() {
    const apartados = {};
    $('rol-matrix').querySelectorAll('.roles-seg').forEach((seg) => {
      const on = seg.querySelector('.roles-seg__opt.on');
      if (on) apartados[on.dataset.ap] = on.dataset.niv;
    });
    return apartados;
  }
  function getCapsValues() {
    return Array.from($('rol-caps').querySelectorAll('input:checked')).map((x) => x.value);
  }

  function marcarSeleccion() {
    document.querySelectorAll('.roles-list-item').forEach((x) =>
      x.classList.toggle('is-sel', String(x.dataset.id) === String(editId)));
  }

  function setEditor(rol) {
    if (rol) {
      editId = rol.id_rol;
      $('rol-nombre').value = rol.nombre || '';
      $('rol-desc').value = rol.descripcion || '';
      renderMatrix(rol.apartados || {});
      renderCaps(rol.capacidades || []);
      $('rol-eliminar').hidden = (rol.codigo === 'administrador');
    } else {
      editId = null;
      $('rol-nombre').value = '';
      $('rol-desc').value = '';
      renderMatrix({});
      renderCaps([]);
      $('rol-eliminar').hidden = true;
    }
    marcarSeleccion();
  }

  function renderLista() {
    const cont = $('rol-list');
    if (!rolesCache.length) { cont.innerHTML = '<div class="roles-empty">Sin roles</div>'; return; }
    cont.innerHTML = '';
    rolesCache.forEach((r) => {
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'roles-list-item';
      it.dataset.id = r.id_rol;
      const name = document.createElement('span');
      name.className = 'roles-list-item__name';
      name.textContent = r.nombre;
      const meta = document.createElement('span');
      meta.className = 'roles-list-item__meta';
      meta.textContent = (r.usuarios || 0) + ' usuario(s)';
      it.appendChild(name);
      it.appendChild(meta);
      if (r.codigo === 'administrador') {
        const lock = document.createElement('i');
        lock.className = 'fas fa-lock roles-list-item__lock';
        it.appendChild(lock);
      }
      it.addEventListener('click', () => abrirRol(r.id_rol));
      cont.appendChild(it);
    });
    marcarSeleccion();
  }

  async function cargarLista() {
    rolesCache = await jget(api);
    renderLista();
  }
  async function abrirRol(id) {
    try { setEditor(await jget(api + '/' + id)); msg(''); }
    catch (e) { msg(e.message, 'error'); }
  }

  async function guardar() {
    const nombre = $('rol-nombre').value.trim();
    if (!nombre) { msg('El nombre es obligatorio', 'error'); return; }
    const payload = {
      nombre,
      descripcion: $('rol-desc').value.trim(),
      apartados: getMatrixValues(),
      capacidades: getCapsValues()
    };
    try {
      if (editId) {
        await jsend(api + '/' + editId, 'PUT', payload);
        msg('Rol actualizado');
      } else {
        const r = await jsend(api, 'POST', payload);
        editId = r.id_rol;
        msg('Rol creado');
      }
      await cargarLista();
      if (editId) await abrirRol(editId);
    } catch (e) { msg(e.message, 'error'); }
  }

  async function eliminar() {
    if (!editId) return;
    if (!await window.confirmar('¿Eliminar este rol? Esta acción no se puede deshacer.')) return;
    try {
      await jsend(api + '/' + editId, 'DELETE');
      msg('Rol eliminado');
      setEditor(null);
      await cargarLista();
    } catch (e) { msg(e.message, 'error'); }
  }

  async function init() {
    try {
      CAT = await jget(api + '/catalogos');
      setEditor(null);
      await cargarLista();
    } catch (e) { msg(e.message || 'Error al cargar', 'error'); }
    $('rol-nuevo').addEventListener('click', () => { setEditor(null); msg(''); });
    $('rol-cancelar').addEventListener('click', () => { setEditor(null); msg(''); });
    $('rol-guardar').addEventListener('click', guardar);
    $('rol-eliminar').addEventListener('click', eliminar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();