/* filter.js — manejo de paneles del mapa (filtros, crear cuarentena, crear parcelación) */

const $ = (id) => document.getElementById(id);

function hide(el) { if (el) el.classList.add("hidden"); }
function toggle(el, others = []) {
  if (!el) return;
  const willShow = el.classList.contains("hidden");
  others.forEach(hide);
  el.classList.toggle("hidden", !willShow);
}

document.addEventListener("DOMContentLoaded", () => {
  const filterPanel       = $("filter-panel");
  const quarantinePanel   = $("quarantine-panel");
  const parcelacionModal  = $("parcelacion-modal");

  const filterButton      = $("filter-button");
  const createQuarantine  = $("create-quarantine-button");
  const createParcela     = $("create-parcela");
  const cancelQuarantine  = $("cancel-quarantine");
  const cancelParcela     = $("cancel-parcelacion");

  // Botón de filtros (cierra los otros paneles al abrir)
  if (filterButton) {
    filterButton.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(filterPanel, [quarantinePanel, parcelacionModal]);
    });
  }

  // Crear cuarentena
  if (createQuarantine) {
    createQuarantine.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(quarantinePanel, [filterPanel, parcelacionModal]);
    });
  }
  if (cancelQuarantine) cancelQuarantine.addEventListener("click", () => hide(quarantinePanel));

  // Crear parcelación
  if (createParcela) {
    createParcela.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle(parcelacionModal, [filterPanel, quarantinePanel]);
    });
  }
  if (cancelParcela) cancelParcela.addEventListener("click", () => hide(parcelacionModal));

  // Cerrar el panel de filtros al hacer clic fuera de él
  document.addEventListener("click", (e) => {
    if (!filterPanel || filterPanel.classList.contains("hidden")) return;
    if (filterPanel.contains(e.target) || (filterButton && filterButton.contains(e.target))) return;
    hide(filterPanel);
  });
});

/* ---- Soporte para las vistas CRUD (links del sidebar) ---- */
function setupSidebarLinks() {
  const sidebarLinks = document.querySelectorAll("a[data-load-table]");
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const tableName = link.getAttribute("data-load-table");
      if (typeof loadItems === "function") loadItems(tableName);
      history.pushState(null, "", link.href);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSidebarLinks();
  if (typeof getTableNameFromUrl === "function") {
    const currentTable = getTableNameFromUrl();
    if (currentTable && typeof loadItems === "function") loadItems(currentTable);
  }
});