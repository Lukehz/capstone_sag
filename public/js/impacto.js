// Análisis de impacto espacial: qué parcelas caen dentro de una zona de cuarentena.
// Usa Turf.js (cargado en la página del mapa). Las parcelas y sus marcadores los
// publica parcelas.js en window.__PARCELAS = [{ id, lng, lat, el, cultivo, comuna }].
(function () {
  let resaltadas = [];

  // Devuelve las parcelas que caen dentro del `feature` de la cuarentena.
  // Sirve para trazado (polígono) y radio (círculo dibujado como polígono);
  // como respaldo, usa centro + radio si el feature no fuese un polígono.
  function parcelasEnZona(feature) {
    if (!feature || typeof turf === 'undefined') return [];
    const parcelas = window.__PARCELAS || [];
    const tipo = feature.geometry && feature.geometry.type;
    const esPolig = tipo === 'Polygon' || tipo === 'MultiPolygon';
    const props = feature.properties || {};
    const radioM = parseFloat(props.radio);
    const centro = (props.longitud != null && props.latitud != null)
      ? turf.point([Number(props.longitud), Number(props.latitud)])
      : null;

    return parcelas.filter((p) => {
      const pt = turf.point([p.lng, p.lat]);
      try {
        if (esPolig) return turf.booleanPointInPolygon(pt, feature);
        if (centro && radioM > 0) return turf.distance(pt, centro, { units: 'meters' }) <= radioM;
      } catch (_) {
        return false;
      }
      return false;
    });
  }

  // Marca en el mapa las parcelas afectadas (clase CSS en su marcador).
  function resaltar(lista) {
    limpiar();
    resaltadas = lista || [];
    resaltadas.forEach((p) => { if (p.el) p.el.classList.add('is-afectada'); });
  }

  // Quita el resaltado anterior.
  function limpiar() {
    resaltadas.forEach((p) => { if (p.el) p.el.classList.remove('is-afectada'); });
    resaltadas = [];
  }

  window.Impacto = { parcelasEnZona, resaltar, limpiar };
})();
