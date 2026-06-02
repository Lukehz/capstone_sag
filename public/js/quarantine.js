import { map } from './map.js';

// Cablea el botón "Resaltar parcelas" de un popup de cuarentena: alterna el
// resaltado de las parcelas que caen dentro de la zona (análisis de impacto).
function wireImpactoBtn(popupContent, afectadas, n) {
  const btn = popupContent.querySelector('.impacto-btn');
  if (!btn || !window.Impacto) return;
  let activo = false;
  btn.addEventListener('click', () => {
    activo = !activo;
    if (activo) {
      window.Impacto.resaltar(afectadas);
      btn.classList.add('is-on');
      btn.innerHTML = '<i class="fas fa-eye-slash"></i> Quitar resaltado';
    } else {
      window.Impacto.limpiar();
      btn.classList.remove('is-on');
      btn.innerHTML = '<i class="fas fa-crosshairs"></i> Resaltar ' + n + ' parcela(s)';
    }
  });
}

let drawingMode = false;
let quarantinePoints = [];
let quarantineCircle = null;
let quarantineCenter = null;
let isDeleting = false;
let currentPopup = null; // Variable para almacenar el popup actual
let trazadoCerrado = false;   // true cuando el polígono ya fue cerrado por el usuario
let trazadoRafId = null;      // id del requestAnimationFrame de la animación del trazado
// Paleta del trazado (coral, coherente con la leyenda y cuarentenas activas)
const TZ_COLOR = '#E0633A';
const TZ_COLOR_DARK = '#D85A30';
// Conteo de cuarentenas activas visibles (para el umbral de la animación ambiente)
const qCounts = { radio: 0, trazado: 0 };
// Colores de la visualización de cuarentenas en el mapa (cambia aquí para recolorear)
const Q_FILL   = '#ef4444';  // relleno y anillo
const Q_BORDER = '#b91c1c';  // borde
const Q_HOVER  = '#f87171';  // borde al pasar el mouse

// Función para recoger el comentario del usuario
function getComment() {
  const commentElement = document.getElementById('quarantine-comment');
  return commentElement ? commentElement.value.trim() : '';
}

const cancelDrawing = () => {
   // Guardar el estado actual de los toggles
   const radiusToggle = document.getElementById('quarantine-circle-toggle');
   const polygonToggle = document.getElementById('quarantine-toggle');
   const wasRadiusActive = radiusToggle && radiusToggle.checked;
   const wasPolygonActive = polygonToggle && polygonToggle.checked;
 
   clearQuarantineForm();
   // Limpiar los puntos de cuarentena
   quarantinePoints = [];
 
   // Eliminar las capas temporales del círculo (radio)
   limpiarCapasRadio();
 
   // Eliminar los puntos y la línea del polígono temporal
   if (map.getSource('quarantine-points')) {
     map.removeLayer('quarantine-points');
     map.removeSource('quarantine-points');
   }
   
   if (map.getSource('quarantine-line')) {
     map.removeLayer('quarantine-line');
     map.removeSource('quarantine-line');
   }
   
   if (map.getSource('quarantine-polygon')) {
     map.removeLayer('quarantine-polygon');
     map.removeSource('quarantine-polygon');
   }
 
   // Reiniciar el modo de dibujo
   endDrawing();
 
   // Restaurar el estado de visualización previo
   if (wasRadiusActive) {
     fetchAndDisplayQuarantines('radio');
   } else if (wasPolygonActive) {
     fetchAndDisplayQuarantines('trazado');
   }
 };

 // Asignar el evento al botón para cancelar el dibujo en proceso
document.getElementById('cancel-quarantine').addEventListener('click', () => {
  cancelDrawing();
  window.notify('Cuarentena cancelada.');
});


const saveQuarantine = async () => {
  const comment = getComment();
  const idSector = document.getElementById("SelectComuna").value; // Obtener el id_sector desde el dropdown
  if (!idSector) {
    window.notify('Debe seleccionar un sector.');
    return;
  }
  const activa = 1;
  const type = quarantineCircle ? 'radius' : 'polygon';
  let points = [];

  console.log(`Tipo de cuarentena: ${type}`); // Verificar el tipo de cuarentena
  console.log(`Puntos en el trazado: ${quarantinePoints.length}`); // Verificar la cantidad de puntos

  // Validación para cuarentena por trazado (polígono)
  if (type === 'polygon') {
    if (quarantinePoints.length < 3) {
      setTrazadoHint('Agrega al menos 3 puntos antes de guardar.', true);
      return; // Detener la ejecución si no hay suficientes puntos
    }
    if (poligonoSeAutointersecta(quarantinePoints.map(p => p.coords))) {
      setTrazadoHint('El trazado se cruza a sí mismo. Corrígelo antes de guardar.', true);
      return;
    }
    points = quarantinePoints.map(point => point.coords);
  } else if (type === 'radius') {
    if (!quarantineCenter) {
      window.notify('Debe seleccionar un punto central para la cuarentena por radio.');
      return;
    }
    points.push(quarantineCenter);
  }

  // Validación del radio
  const radiusInput = document.getElementById('quarantine-radius');
  const radius = radiusInput.value ? parseFloat(radiusInput.value) : null;

  if (radius !== null && radius <= 0) {
    window.notify('El radio debe ser un valor positivo.');
    return; // Detener la ejecución si el radio no es válido
  }

  // Datos de la cuarentena que se enviarán al servidor
  const quarantineData = {
    points,
    comment,
    type,
    radius: radius !== null ? radius : 0,
    idSector, // Usar idSector para guardar el id de la comuna en la base de datos
    activa: activa
  };

  // Enviar la cuarentena al servidor
  try {
    const response = await fetch('/quarantines/save-quarantine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quarantineData),
    });

    if (response.ok) {
      const result = await response.json();
      window.notify('Cuarentena guardada con éxito con ID: ' + result.id_cuarentena);

      document.getElementById('quarantine-type').value = 'seleccionar';
      clearQuarantineForm();

      // Activar el toggle correspondiente según el tipo de cuarentena
      const radiusToggle = document.getElementById('quarantine-circle-toggle');
      const polygonToggle = document.getElementById('quarantine-toggle');

      if (type === 'radius') {
        if (radiusToggle) {
          radiusToggle.checked = true;
          if (polygonToggle) {
            polygonToggle.checked = false;
          }
          if (map.getLayer('quarantine-layer')) {
            map.setLayoutProperty('quarantine-layer', 'visibility', 'none');
          }
          fetchAndDisplayQuarantines('radio');
        }
      } else {
        if (polygonToggle) {
          polygonToggle.checked = true;
          if (radiusToggle) {
            radiusToggle.checked = false;
          }
          if (map.getLayer('quarantine-circle-layer')) {
            map.setLayoutProperty('quarantine-circle-layer', 'visibility', 'none');
          }
          fetchAndDisplayQuarantines('trazado');
        }
      }

      cancelDrawing(); // Cancelar el dibujo tras guardar
    } else {
      const errorData = await response.json();
      console.error('Error:', errorData);
      window.notify('Error al guardar la cuarentena: ' + errorData.error);
    }
  } catch (error) {
    console.error('Error al guardar la cuarentena:', error);
    window.notify('Se produjo un error al guardar la cuarentena.');
  }
};

document.getElementById('save-quarantine').addEventListener('click', saveQuarantine);

// Nueva función para limpiar el formulario
function clearQuarantineForm() {
  // Limpiar el campo de comentario
  const commentElement = document.getElementById('quarantine-comment');
  if (commentElement) {
    commentElement.value = '';
  }

  // Limpiar el campo de radio
  const radiusElement = document.getElementById('quarantine-radius');
  if (radiusElement) {
    radiusElement.value = '';
  }
  mostrarCampoRadio(false);

  // Resetear el tipo de cuarentena al valor por defecto y refrescar su dropdown
  const typeElement = document.getElementById('quarantine-type');
  if (typeElement) {
    typeElement.value = 'seleccionar';
    if (window.enhanceSelect) window.enhanceSelect(typeElement);
  }

  // Resetear el sector y refrescar su dropdown (.ms) para que no quede el último elegido
  const sectorElement = document.getElementById('SelectComuna');
  if (sectorElement) {
    sectorElement.value = '';
    if (window.enhanceSelect) window.enhanceSelect(sectorElement);
  }

  // Limpiar variables globales
  quarantinePoints = [];
  quarantineCenter = null;
  
  // Eliminar las capas temporales del círculo (radio)
  limpiarCapasRadio();

  // Limpiar capas temporales del mapa
  ['quarantine-points', 'quarantine-line', 'quarantine-polygon'].forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }
  });

  if (typeElement && window.enhanceSelect) window.enhanceSelect(typeElement);
}

// Función para actualizar los puntos de cuarentena en el mapa
const updateQuarantinePoints = () => {
  if (quarantinePoints.length === 0) return;

  const pointsData = {
    type: 'FeatureCollection',
    features: quarantinePoints.map(point => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point.coords }
    }))
  };

  if (!map.getSource('quarantine-points')) {
    map.addSource('quarantine-points', { type: 'geojson', data: pointsData });
    map.addLayer({
      id: 'quarantine-points',
      type: 'circle',
      source: 'quarantine-points',
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-color': TZ_COLOR_DARK,
        'circle-stroke-width': 3
      }
    });
  } else {
    map.getSource('quarantine-points').setData(pointsData);
  }

  if (quarantinePoints.length > 1) {
    const lineData = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: quarantinePoints.map(point => point.coords)
      }
    };

    if (!map.getSource('quarantine-line')) {
      map.addSource('quarantine-line', { type: 'geojson', data: lineData });
      map.addLayer({
        id: 'quarantine-line',
        type: 'line',
        source: 'quarantine-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': TZ_COLOR, 'line-width': 3, 'line-dasharray': [0, 4, 3] }
      });
    } else {
      map.getSource('quarantine-line').setData(lineData);
    }
  }
};

// Función para actualizar el polígono de cuarentena en el mapa
const updateQuarantinePolygon = () => {
  if (quarantinePoints.length < 3) return;

  const polygonData = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[...quarantinePoints.map(point => point.coords), quarantinePoints[0].coords]]
    }
  };

  if (!map.getSource('quarantine-polygon')) {
    map.addSource('quarantine-polygon', { type: 'geojson', data: polygonData });
    map.addLayer({
      id: 'quarantine-polygon',
      type: 'fill',
      source: 'quarantine-polygon',
      paint: { 'fill-color': TZ_COLOR, 'fill-opacity': 0.18, 'fill-outline-color': TZ_COLOR_DARK }
    });
  } else {
    map.getSource('quarantine-polygon').setData(polygonData);
  }
};

function createQuarantineByPolygon() {
  if (quarantinePoints.length < 3) {
    window.notify("Por favor, dibuje al menos 3 puntos para crear un polígono.");
    return;
  }

  updateQuarantinePolygon();

  const quarantineData = {
    type: 'polygon',
    points: quarantinePoints.map(point => point.coords),
    comment: getComment(),
  };
  
  /// saveQuarantine(quarantineData);
}

function createQuarantineByRadius() {
  if (!quarantineCenter) {
    window.notify("Por favor, seleccione un centro para la cuarentena por radio.");
    return;
  }

  const radius = parseFloat(document.getElementById('quarantine-radius').value);
  if (isNaN(radius) || radius <= 0) {
    window.notify("Por favor, especifique un radio válido para la cuarentena.");
    return;
  }

  const quarantineData = {
    type: 'radius',
    points: [quarantineCenter],
    comentario: getComment(),
    radius: radius,
  };

  saveQuarantine(quarantineData);
}

// Asegúrate de que esta función esté definida correctamente
function generateCircle(center, radius) {
  const points = 64;
  const coords = [];
  const earthRadius = 6371000;

  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);
    
    const newCoords = [
      center[0] + (offsetX / earthRadius) * (180 / Math.PI) / Math.cos(center[1] * Math.PI / 180),
      center[1] + (offsetY / earthRadius) * (180 / Math.PI)
    ];

    coords.push(newCoords);
  }

  return coords;
}

// Update the startDrawing function
function startDrawing(mode) {

  drawingMode = mode;
  quarantinePoints = [];
  quarantineCenter = null;

  // Limpiar cualquier dibujo temporal previo (trazado o radio)
  ['quarantine-points', 'quarantine-line', 'quarantine-polygon'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
  limpiarCapasTrazadoExtra();
  limpiarCapasRadio();
  // Deshabilitar la interactividad de las capas durante el dibujo
  if (map.getLayer('quarantine-circle-layer')) {
    map.setLayoutProperty('quarantine-circle-layer', 'visibility', 'visible');
    map.setFilter('quarantine-circle-layer', ['==', 'id', '']);
  }
  if (map.getLayer('quarantine-layer')) {
    map.setLayoutProperty('quarantine-layer', 'visibility', 'visible');
    map.setFilter('quarantine-layer', ['==', 'id', '']);
  }

  trazadoCerrado = false;
  detenerAnimacionRadio();
  if (mode === 'trazado') {
    iniciarAyudaTrazado();
    map.getCanvas().style.cursor = 'crosshair';
    iniciarAnimacionTrazado();
  } else if (mode === 'radio') {
    ocultarAyudaTrazado();
    map.getCanvas().style.cursor = 'crosshair';
    detenerAnimacionTrazado();
    iniciarAnimacionRadio();
  } else {
    ocultarAyudaTrazado();
    map.getCanvas().style.cursor = '';
    detenerAnimacionTrazado();
  }

  //console.log(`Modo de dibujo activado: ${mode}`);
}




function endDrawing() {
  drawingMode = false;
  ocultarAyudaTrazado();
  detenerAnimacionTrazado();
  detenerAnimacionRadio();
  limpiarCapasTrazadoExtra();
  limpiarCapasRadio();
  trazadoCerrado = false;
  if (map.getCanvas()) map.getCanvas().style.cursor = '';
  // Restaurar la interactividad de las capas
  if (map.getLayer('quarantine-circle-layer')) {
    map.setFilter('quarantine-circle-layer', null);
  }
  if (map.getLayer('quarantine-layer')) {
    map.setFilter('quarantine-layer', null);
  }

  //console.log("Modo de dibujo desactivado");
}

// Manejador principal de clic en modo dibujo (trazado / radio)
map.on('click', (e) => {
  if (!drawingMode) return;
  e.originalEvent.stopPropagation();

  const quarantineType = document.getElementById('quarantine-type').value;

  if (quarantineType === 'radio') {
    quarantineCenter = [e.lngLat.lng, e.lngLat.lat];
    updateQuarantineCircle();
    return;
  }

  if (quarantineType === 'trazado') {
    if (trazadoCerrado) return; // el trazado ya está cerrado

    // Snap para cerrar: clic cerca del primer punto (con 3+ puntos) cierra el polígono
    if (quarantinePoints.length >= 3 && cercaDelPrimerPunto(e.point)) {
      cerrarTrazado();
      return;
    }

    const cand = [e.lngLat.lng, e.lngLat.lat];
    // Evitar trazados que se cruzan a sí mismos (reloj de arena, infinito, etc.)
    if (nuevoSegmentoCruza(cand)) {
      setTrazadoHint('Las líneas no pueden cruzarse. Elige otro punto.', true);
      return;
    }

    quarantinePoints.push({ coords: cand });
    flashPunto(cand);
    updateQuarantinePoints();
    updateQuarantinePolygon();
    actualizarPrimerPunto();
    actualizarAyudaTrazado();
  }
});


function updateQuarantineCircle() {
  if (!quarantineCenter) return;

  const radius = parseFloat(document.getElementById('quarantine-radius').value) || 1000;
  const circleCoords = generateCircle(quarantineCenter, radius);
  const ringData = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleCoords] } };
  const outlineData = { type: 'Feature', geometry: { type: 'LineString', coordinates: circleCoords } };
  const centerData = { type: 'Feature', geometry: { type: 'Point', coordinates: quarantineCenter } };

  // Halo pulsante en el centro (debajo de todo)
  if (!map.getSource('temp-quarantine-halo')) {
    map.addSource('temp-quarantine-halo', { type: 'geojson', data: centerData });
    map.addLayer({ id: 'temp-quarantine-halo', type: 'circle', source: 'temp-quarantine-halo',
      paint: { 'circle-radius': 10, 'circle-color': TZ_COLOR, 'circle-opacity': 0 } });
  } else { map.getSource('temp-quarantine-halo').setData(centerData); }

  // Relleno coral suave
  if (!map.getSource('temp-quarantine-circle')) {
    map.addSource('temp-quarantine-circle', { type: 'geojson', data: ringData });
    map.addLayer({ id: 'temp-quarantine-circle', type: 'fill', source: 'temp-quarantine-circle',
      paint: { 'fill-color': TZ_COLOR, 'fill-opacity': 0.15 } });
  } else { map.getSource('temp-quarantine-circle').setData(ringData); }

  // Contorno (línea con hormigas marchando)
  if (!map.getSource('temp-quarantine-outline')) {
    map.addSource('temp-quarantine-outline', { type: 'geojson', data: outlineData });
    map.addLayer({ id: 'temp-quarantine-outline', type: 'line', source: 'temp-quarantine-outline',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': TZ_COLOR, 'line-width': 3, 'line-dasharray': [0, 4, 3] } });
  } else { map.getSource('temp-quarantine-outline').setData(outlineData); }

  // Centro tipo dona
  if (!map.getSource('temp-quarantine-center')) {
    map.addSource('temp-quarantine-center', { type: 'geojson', data: centerData });
    map.addLayer({ id: 'temp-quarantine-center', type: 'circle', source: 'temp-quarantine-center',
      paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': TZ_COLOR_DARK, 'circle-stroke-width': 3 } });
  } else { map.getSource('temp-quarantine-center').setData(centerData); }

  // Marca para la lógica de guardado (saveQuarantine usa esto para detectar el tipo)
  quarantineCircle = { id: 'temp-quarantine-circle' };
}
// Manejadores de eventos de clic en el mapa
map.on('click', 'quarantine-points', (e) => {
  const feature = e.features[0];
  const coordinates = feature.geometry.coordinates.slice();

  
}); 

document.getElementById('quarantine-type').addEventListener('change', function(e) {
  
  // Solo bloquear el cambio si ya hay un dibujo en progreso (puntos o centro).
  // Si aún no se dibujó nada, se permite cambiar de trazado a radio (y viceversa).
  if (drawingMode && (quarantinePoints.length > 0 || quarantineCenter)) {
    
    // Restaurar el valor anterior del select
    this.value = this.dataset.lastValue || '';
    
    // Mostrar alerta al usuario
    window.notify('Por favor termine o cancele el dibujo actual antes de cambiar de opción.');
    
    // Asegurarnos que el modo de dibujo sigue activo (con su tipo real)
    drawingMode = this.value || drawingMode;
    
    // Mantener visible el campo de radio si estaba en ese modo
    if (this.value === 'radio') {
      mostrarCampoRadio(true);
    }
    
    return;
  }

  this.dataset.lastValue = this.value;
  
  const radiusInput = document.getElementById('quarantine-radius');
 

 
  if (this.value === 'radio') {
    mostrarCampoRadio(true);
    startDrawing('radio');
  } else if (this.value === 'trazado') {
    mostrarCampoRadio(false);
    startDrawing('trazado');
  } else {
    mostrarCampoRadio(false);
    endDrawing();
  }
});

document.getElementById('quarantine-radius').addEventListener('input', updateQuarantineCircle);


// (Handler de clic duplicado eliminado: la lógica de dibujo quedó consolidada
//  en el manejador principal de arriba.)

function updateQuarantinePolygons(features, type) {
  const esRadio = type === 'radio';
  const sourceId  = esRadio ? 'quarantine-circle-source'  : 'quarantine-source';
  const fillId    = esRadio ? 'quarantine-circle-layer'   : 'quarantine-layer';
  const outlineId = esRadio ? 'quarantine-circle-outline' : 'quarantine-outline';

  qCounts[esRadio ? 'radio' : 'trazado'] = features.length;

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: 'geojson',
      generateId: true,
      data: { type: 'FeatureCollection', features: features }
    });
    // Relleno (se resalta al pasar el mouse)
    map.addLayer({
      id: fillId, type: 'fill', source: sourceId,
      paint: {
        'fill-color': Q_FILL,
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.5, 0.22]
      }
    });
    if (!esRadio) {
      // Trazado: aro que se expande sobre el borde (lo anima qPulseLoop)
      map.addLayer({
        id: 'quarantine-pulse', type: 'line', source: sourceId,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': Q_FILL, 'line-width': 2, 'line-blur': 3.5, 'line-opacity': 0 }
      });
    }
    // Borde (se engrosa/aclara al pasar el mouse)
    map.addLayer({
      id: outlineId, type: 'line', source: sourceId,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], Q_HOVER, Q_BORDER],
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 5, 2.5],
        'line-opacity': 1
      }
    });
  } else {
    map.getSource(sourceId).setData({ type: 'FeatureCollection', features: features });
  }

  // Radio: anillo fino que crece en diámetro DESDE EL CENTRO (estilo del demo)
  if (esRadio) {
    const centros = features.map(f => {
      const ring = f.geometry.coordinates[0];
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < ring.length - 1; i++) { sx += ring[i][0]; sy += ring[i][1]; n++; }
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [sx / n, sy / n] }, properties: {} };
    });
    const pingSrc = 'quarantine-circle-ping-source';
    if (!map.getSource(pingSrc)) {
      map.addSource(pingSrc, { type: 'geojson', data: { type: 'FeatureCollection', features: centros } });
      map.addLayer({
        id: 'quarantine-circle-ping', type: 'circle', source: pingSrc,
        paint: {
          'circle-radius': 4,
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': Q_FILL,
          'circle-stroke-width': 2.5,
          'circle-stroke-opacity': 0
        }
      });
    } else {
      map.getSource(pingSrc).setData({ type: 'FeatureCollection', features: centros });
    }
  }

  const vis = esRadio
    ? [fillId, outlineId, 'quarantine-circle-ping']
    : ['quarantine-pulse', fillId, outlineId];
  vis.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible'); });
}

async function fetchAllQuarantines() {
  const response = await fetch('/quarantines/get-all-quarantines');
  if (!response.ok) throw new Error(`Error HTTP! estado: ${response.status}`);
  return response.json();
}

async function fetchAllRadiusQuarantines() {
  const response = await fetch('/quarantines/radius');
  if (!response.ok) throw new Error(`Error HTTP! estado: ${response.status}`);
  return response.json();
}

function fetchAndDisplayQuarantines(type = null) {
  //console.log('Iniciando fetchAndDisplayQuarantines', type ? `para tipo: ${type}` : 'para todos los tipos');

  const fetchFunction = type === 'radio' ? fetchAllRadiusQuarantines : fetchAllQuarantines;

  if (window.MapLoad) MapLoad.begin();
  fetchFunction()
    .then(data => {
      //console.log('Datos de cuarentenas recibidos:', data);

      const quarantines = Array.isArray(data) ? data : [data];

      data.forEach(quarantine => {
     // console.log(`Cuarentena completa: ${JSON.stringify(quarantine)}`);
    });

      const filteredQuarantines = quarantines.filter(quarantine => {
        const isActive = quarantine.activa === 1 || quarantine.activa === '1' || quarantine.activa === true;  // Verifica valores posibles
        
        if (type === 'radio') return quarantine.radio > 0 && isActive;
        if (type === 'trazado') return !quarantine.radio && isActive;
        return isActive;  // Solo cuarentenas activas
      });
      //console.log('Cuarentenas filtradas:', filteredQuarantines);


      const features = filteredQuarantines.map(quarantine => {
        if (quarantine.radio) {
          const center = [quarantine.longitud, quarantine.latitud];
        
          const circleCoords = generateCircle(center, quarantine.radio);
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [circleCoords]
            },
            properties: {
              id: quarantine.id,
              comentario: quarantine.comentario || 'Sin comentario',
              tipo: 'radio',
              radio: quarantine.radio
            }
          };
        } else if (quarantine.conexiones && quarantine.conexiones.length >= 3) {
          return {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                ...quarantine.conexiones.map(conn => [conn.longitud_INI, conn.latitud_INI]),
                [quarantine.conexiones[0].longitud_INI, quarantine.conexiones[0].latitud_INI] // Cerrar el polígono
              ]]
            },
            properties: {
              id: quarantine.id,
              comentario: quarantine.comentario || 'Sin comentario',
              tipo: 'trazado'
            }
          };
        }
        return null; // Retornar null para cuarentenas que no cumplen con ninguna condición
        
      }).filter(Boolean);

      //console.log('Features generadas:', features);
      updateQuarantinePolygons(features, type);
    })
    .then(() => { if (window.MapLoad) MapLoad.done(); })
    .catch(error => {
      console.error('Error al obtener cuarentenas:', error);
      window.notify(`Hubo un error al obtener las cuarentenas: ${error.message}`);
      if (window.MapLoad) MapLoad.fail();
    });

    map.on('click', 'quarantine-circle-layer', (e) => {
      if (drawingMode) return;
      if (!e.features.length) return;
    
      const feature = e.features[0];
      const properties = feature.properties;

      // Análisis de impacto: parcelas que caen dentro de esta cuarentena
      const afectadas = (window.Impacto) ? window.Impacto.parcelasEnZona(feature) : [];
      const nAfectadas = afectadas.length;

      // Cerrar el popup anterior si existe
      if (currentPopup) {
        currentPopup.remove();
      }
    
      // Crear el contenido del popup
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <div class="lm-popup">
          <div class="lm-popup__head">
            <span class="lm-popup__title"><i class="fas fa-circle-notch"></i> Cuarentena #${properties.id}</span>
            <span class="lm-popup__badge is-danger">Activa</span>
          </div>
          <div class="lm-popup__body">
            <div class="lm-popup__row"><span><i class="fas fa-comment-dots"></i> Comentario</span><b>${properties.comentario || 'Sin comentario'}</b></div>
            <div class="lm-popup__row"><span><i class="fas fa-ruler-combined"></i> Radio</span><b>${properties.radio} m</b></div>
            <div class="lm-popup__row"><span><i class="fas fa-seedling"></i> Parcelas dentro</span><b>${nAfectadas}</b></div>
          </div>
          <div class="lm-popup__actions">
            ${nAfectadas > 0 ? '<button class="impacto-btn lm-popup__btn"><i class="fas fa-crosshairs"></i> Resaltar ' + nAfectadas + ' parcela(s)</button>' : ''}
            ${(window.Perm && window.Perm.tieneCapacidad('cuarentena.activar_desactivar')) ? '<button class="deactivate-button lm-popup__btn lm-popup__btn--danger"><i class="fas fa-ban"></i> Desactivar</button>' : ''}
          </div>
        </div>
      `;
            wireImpactoBtn(popupContent, afectadas, nAfectadas);
            // Agregar el evento click al botón de desactivar
        const deactivateButton = popupContent.querySelector('.deactivate-button');
        if (deactivateButton) deactivateButton.addEventListener('click', async () => {
          if (await window.confirmar('¿Estás seguro de desactivar esta cuarentena?')) {
          

            try {
              await deactivateQuarantine(properties.id);
              if (!moverADesactivada(properties.id)) refrescarCapasVisibles();
            } catch (err) {
              window.notify('Hubo un error al desactivar la cuarentena: ' + err.message);
            }
          }
          if (currentPopup) {
            currentPopup.remove();
          }
          
        });

      // Crear y mostrar el popup
      currentPopup = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setDOMContent(popupContent)
        .addTo(map);
      currentPopup.on('close', () => { if (window.Impacto) window.Impacto.limpiar(); });
    });
    
    map.on('click', 'quarantine-layer', (e) => {
      if (drawingMode) return;
      if (!e.features.length) return;
      
    
      const feature = e.features[0];
      const properties = feature.properties;

      // Análisis de impacto: parcelas que caen dentro de esta cuarentena
      const afectadas = (window.Impacto) ? window.Impacto.parcelasEnZona(feature) : [];
      const nAfectadas = afectadas.length;
    
      // Cerrar el popup anterior si existe
      if (currentPopup) {
        currentPopup.remove();
      }
      
    
      // Crear el contenido del popup
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <div class="lm-popup">
          <div class="lm-popup__head">
            <span class="lm-popup__title"><i class="fas fa-draw-polygon"></i> Cuarentena #${properties.id}</span>
            <span class="lm-popup__badge is-danger">Activa</span>
          </div>
          <div class="lm-popup__body">
            <div class="lm-popup__row"><span><i class="fas fa-comment-dots"></i> Comentario</span><b>${properties.comentario || 'Sin comentario'}</b></div>
            <div class="lm-popup__row"><span><i class="fas fa-seedling"></i> Parcelas dentro</span><b>${nAfectadas}</b></div>
          </div>
          <div class="lm-popup__actions">
            ${nAfectadas > 0 ? '<button class="impacto-btn lm-popup__btn"><i class="fas fa-crosshairs"></i> Resaltar ' + nAfectadas + ' parcela(s)</button>' : ''}
            ${(window.Perm && window.Perm.tieneCapacidad('cuarentena.activar_desactivar')) ? '<button class="deactivate-button lm-popup__btn lm-popup__btn--danger"><i class="fas fa-ban"></i> Desactivar</button>' : ''}
          </div>
        </div>
      `;
      
      wireImpactoBtn(popupContent, afectadas, nAfectadas);
    
      // Agregar el evento click al botón de desactivar
      const deactivateButton = popupContent.querySelector('.deactivate-button');
      if (deactivateButton) deactivateButton.addEventListener('click', async () => {
        if (await window.confirmar('¿Estás seguro de desactivar esta cuarentena?')) {
          // Aquí podrías hacer la lógica para marcar la cuarentena como inactiva en tu base de datos
          // Esto podría ser una llamada a una API o actualización local

          try {
            await deactivateQuarantine(properties.id);
            if (!moverADesactivada(properties.id)) refrescarCapasVisibles();
          } catch (err) {
            window.notify('Hubo un error al desactivar la cuarentena: ' + err.message);
          }
        }
        if (currentPopup) {
          currentPopup.remove();
        }
        
      });
      
      // Crear y mostrar el popup
      currentPopup = new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setDOMContent(popupContent)
        .addTo(map); 
      currentPopup.on('close', () => { if (window.Impacto) window.Impacto.limpiar(); });
    });
    
  }   

  
  function deactivateQuarantine(id) {
    return fetch(`/quarantines/deactivate-quarantine/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(async response => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || `Error ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            window.notify(`Cuarentena ${id} desactivada exitosamente.`);
            return data;
        }
        throw new Error(data.error || 'Error al desactivar la cuarentena');
    });
}
  
  
  
function toggleQuarantines() {
  const quarantineCheckbox = document.getElementById('quarantine-toggle');
  const isChecked = quarantineCheckbox.checked;

  if (isChecked) {
    //console.log('Mostrando trazados de cuarentena');
    fetchAndDisplayQuarantines('trazado'); // Solo cuarentenas de trazado
  } else {
    //console.log('Ocultando trazados de cuarentena');
    ['quarantine-layer', 'quarantine-outline', 'quarantine-pulse'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });
    qCounts.trazado = 0;
  }
}

// Asignar el evento al checkbox
document.addEventListener('DOMContentLoaded', () => {
  const quarantineCheckbox = document.getElementById('quarantine-toggle');
  
  if (quarantineCheckbox) {
    quarantineCheckbox.addEventListener('change', toggleQuarantines);
    if (quarantineCheckbox.checked) {
      if (map.loaded()) toggleQuarantines();
      else map.on('load', () => toggleQuarantines());
    }
  } else {
    console.error('El checkbox con id "quarantine-toggle" no fue encontrado.');
  }
});


// Modificación de la función toggleQuarantineCircle
function toggleQuarantineCircle() {
  const quarantineCheckbox = document.getElementById('quarantine-circle-toggle');
  const isChecked = quarantineCheckbox.checked;

  if (isChecked) {
   // console.log('Mostrando círculos de cuarentena');
    
    fetchAndDisplayQuarantines('radio'); // Muestra solo las cuarentenas con radio
  } else {
   // console.log('Ocultando círculos de cuarentena');
    ['quarantine-circle-layer', 'quarantine-circle-outline', 'quarantine-circle-ping'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });
    qCounts.radio = 0;
  }
}

// Asignar el evento al checkbox
document.addEventListener('DOMContentLoaded', () => {
  const quarantineCheckbox = document.getElementById('quarantine-circle-toggle');
  
  if (quarantineCheckbox) {
    quarantineCheckbox.addEventListener('change', toggleQuarantineCircle);
    if (quarantineCheckbox.checked) {
      if (map.loaded()) toggleQuarantineCircle();
      else map.on('load', () => toggleQuarantineCircle());
    }
  } else {
    console.error('El checkbox con id "quarantine-circle-toggle" no fue encontrado.');
  }
});

//document para inactivas
document.addEventListener('DOMContentLoaded', function() {
  // Permitir que el botón "Reintentar" del mapa recargue las cuarentenas activas.
  if (window.MapLoad) MapLoad.register(function () { toggleQuarantines(); toggleQuarantineCircle(); });
  document.getElementById('quarantine-inactive').addEventListener('change', function() {
    toggleInactiveQuarantines();
  });
});

function toggleInactiveQuarantines() {
  const inactiveCheckbox = document.getElementById('quarantine-inactive');
  const isChecked = inactiveCheckbox.checked;

  if (isChecked) {
    //console.log('Mostrando cuarentenas inactivas');
    fetchInactiveRadioQuarantines();
    fetchInactiveTrazadoQuarantines();
  } else {
    //console.log('Ocultando cuarentenas inactivas');
    hideInactiveQuarantines();
  }
}

function hideInactiveQuarantines() {
  if (map.getLayer('inactive-quarantine-fill')) {
    map.setLayoutProperty('inactive-quarantine-fill', 'visibility', 'none');
  }
  if (map.getLayer('inactive-quarantine-outline')) {
    map.setLayoutProperty('inactive-quarantine-outline', 'visibility', 'none');
  }
  if (map.getLayer('inactive-quarantine-radio-fill')) {
    map.setLayoutProperty('inactive-quarantine-radio-fill', 'visibility', 'none');
  }
  if (map.getLayer('inactive-quarantine-radio-outline')) {
    map.setLayoutProperty('inactive-quarantine-radio-outline', 'visibility', 'none');
  }
  if (map.getLayer('inactive-quarantine-trazado-fill')) {
    map.setLayoutProperty('inactive-quarantine-trazado-fill', 'visibility', 'none');
  }
  if (map.getLayer('inactive-quarantine-trazado-outline')) {
    map.setLayoutProperty('inactive-quarantine-trazado-outline', 'visibility', 'none');
  }
}


function updateInactiveQuarantinePolygons(features, type) {
  const sourceId = `inactive-quarantine-${type}-source`;
  const fillLayerId = `inactive-quarantine-${type}-fill`;
  const outlineLayerId = `inactive-quarantine-${type}-outline`;

  // Remover capas existentes si existen
  if (map.getLayer(fillLayerId)) {
    map.removeLayer(fillLayerId);
  }
  if (map.getLayer(outlineLayerId)) {
    map.removeLayer(outlineLayerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }

  // Agregar nueva fuente
  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: features
    }
  });

  // Agregar capa de relleno
  map.addLayer({
    id: fillLayerId,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': type === 'radio' ? 'rgb(255, 255, 255)' : 'rgb(255, 255, 255)',
      'fill-opacity': 0.2
    }
  });

  // Agregar capa de contorno
  map.addLayer({
    id: outlineLayerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': type === 'radio' ? '#FFFFFF' : '#FFFFFF',
      'line-width': 1
    }
  });
  map.on('click', fillLayerId, (e) => {
    if (drawingMode) return;
    if (!e.features.length) return;
  
    const feature = e.features[0];
    const properties = feature.properties;
  
    // Cerrar el popup anterior si existe
    if (currentPopup) {
      currentPopup.remove();
    }
  
    // Crear el contenido del popup
    const popupContent = document.createElement('div');
    let contentHTML = `
      <div class="lm-popup">
        <div class="lm-popup__head">
          <span class="lm-popup__title"><i class="fas fa-${type === 'radio' ? 'circle-notch' : 'draw-polygon'}"></i> Cuarentena #${properties.id}</span>
          <span class="lm-popup__badge is-muted">Inactiva</span>
        </div>
        <div class="lm-popup__body">
          <div class="lm-popup__row"><span><i class="fas fa-comment-dots"></i> Comentario</span><b>${properties.comentario || 'Sin comentario'}</b></div>
    `;
  
    // Agregar información del radio solo si es una cuarentena de tipo radio
    if (type === 'radio') {
      contentHTML += `<div class="lm-popup__row"><span><i class="fas fa-ruler-combined"></i> Radio</span><b>${properties.radio} m</b></div>`
    }
  
    contentHTML += `
        </div>
        <div class="lm-popup__actions">
          ${(window.Perm && window.Perm.tieneCapacidad('cuarentena.activar_desactivar')) ? '<button class="activate-button lm-popup__btn lm-popup__btn--primary"><i class="fas fa-check"></i> Activar</button>' : ''}
        </div>
      </div>
    `;
  
    popupContent.innerHTML = contentHTML;
  
    // Agregar el evento click al botón de activar
    const activateButton = popupContent.querySelector('.activate-button');
    if (activateButton) activateButton.addEventListener('click', async () => {
      if (await window.confirmar('¿Estás seguro de activar esta cuarentena?')) {
        try {
          await activateQuarantine(properties.id);
          if (!moverAActivada(properties.id)) refrescarCapasVisibles();
        } catch (error) {
          console.error('Error al activar la cuarentena:', error);
          window.notify('Hubo un error al activar la cuarentena: ' + error.message);
        }
        if (currentPopup) currentPopup.remove();
      }
    });
  
    currentPopup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setDOMContent(popupContent)
      .addTo(map);
  });
}

//activate

function activateQuarantine(id) {
  return fetch(`/quarantines/activa/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(async response => {
    if (!response.ok) {
      // Intentar obtener el mensaje de error del servidor
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Error ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      window.notify(`Cuarentena ${id} activada exitosamente.`);
      return data; // Retornamos los datos para la cadena de promesas
    } else {
      throw new Error(data.error || 'Error desconocido al activar la cuarentena');
    }
  });
}

function displayInactiveRadioQuarantines(quarantines) {
  //console.log('Cuarentenas radio recibidas:', quarantines); // Debug log

  const features = quarantines.map(quarantine => {
    if (quarantine.radio) {
      const center = [quarantine.longitud, quarantine.latitud];
      const circleCoords = generateCircle(center, quarantine.radio);
      
      // Log para debug
      //console.log('Creando feature para cuarentena:', quarantine);
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        },
        properties: {
          id: quarantine.id_cuarentena || quarantine.id, // Asegurarse de usar el campo correcto
          comentario: quarantine.comentario || 'Sin comentario',
          tipo: 'radio',
          radio: quarantine.radio,
          inactive: true
        }
      };
    }
    return null;
  }).filter(Boolean);

  //console.log('Features de cuarentenas inactivas por radio generadas:', features); // Debug log
  updateInactiveQuarantinePolygons(features, 'radio');
}

function displayInactiveTrazadoQuarantines(quarantines) {
 // console.log('Cuarentenas trazado recibidas:', quarantines); // Debug log

  const features = quarantines.map(quarantine => {
    if (quarantine.conexiones && quarantine.conexiones.length >= 3) {
      // Log para debug
      //console.log('Creando feature para cuarentena trazado:', quarantine);
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            ...quarantine.conexiones.map(conn => [conn.longitud_INI, conn.latitud_INI]),
            [quarantine.conexiones[0].longitud_INI, quarantine.conexiones[0].latitud_INI]
          ]]
        },
        properties: {
          id: quarantine.id_cuarentena || quarantine.id, // Asegurarse de usar el campo correcto
          comentario: quarantine.comentario || 'Sin comentario',
          tipo: 'trazado',
          inactive: true
        }
      };
    }
    return null;
  }).filter(Boolean);

  //console.log('Features de cuarentenas inactivas por trazado generadas:', features); // Debug log
  updateInactiveQuarantinePolygons(features, 'trazado');
}
function fetchInactiveRadioQuarantines() {
  fetch('/quarantines/inactiva')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
     // console.log('Datos de cuarentenas inactivas por radio recibidos:', data);
      const quarantines = Array.isArray(data) ? data : data.data;
      displayInactiveRadioQuarantines(quarantines);
    })
    .catch(error => {
      console.error('Error al obtener cuarentenas inactivas por radio:', error);
      window.notify('Hubo un error al obtener las cuarentenas inactivas por radio');
    });
}

function fetchInactiveTrazadoQuarantines() {
  fetch('/quarantines/inactiva-trazado')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
     // console.log('Datos de cuarentenas inactivas por trazado recibidos:', data);
      const quarantines = Array.isArray(data) ? data : data.data;
      displayInactiveTrazadoQuarantines(quarantines);
    })
    .catch(error => {
      console.error('Error al obtener cuarentenas inactivas por trazado:', error);
      window.notify('Hubo un error al obtener las cuarentenas inactivas por trazado');
    });
}
// Función auxiliar para activar un toggle y actualizar la visualización
function activateToggle(type) {
  const radiusToggle = document.getElementById('quarantine-circle-toggle');
  const polygonToggle = document.getElementById('quarantine-toggle');
  
  cancelDrawing();

  if (type === 'radio') {
    if (radiusToggle) {
      radiusToggle.checked = true;
      if (polygonToggle) {
        polygonToggle.checked = false;
      }
      toggleQuarantineCircle();
    }
  } else {
    if (polygonToggle) {
      polygonToggle.checked = true;
      if (radiusToggle) {
        radiusToggle.checked = false;
      }
      toggleQuarantines();
    }
  }
}

// Nueva función de inicialización
function initializeQuarantineState() {
  // Resetear variables globales
  drawingMode = false;
  quarantinePoints = [];
  quarantineCircle = null;
  quarantineCenter = null;
  isDeleting = false;
  currentPopup = null;

  // Resetear formularios
  const commentElement = document.getElementById('quarantine-comment');
  if (commentElement) {
    commentElement.value = '';
  }

  const radiusElement = document.getElementById('quarantine-radius');
  if (radiusElement) {
    radiusElement.value = '';
  }
  mostrarCampoRadio(false);

  const typeElement = document.getElementById('quarantine-type');
  if (typeElement) {
    typeElement.value = 'seleccionar';
  }

  const Select = document.getElementById("SelectComuna"); 
  if (Select) {
    Select.value = 'seleccionar';
  }

  // Mantener visibles las capas de cuarentena por defecto (toggles de visibilidad)
  const radiusToggle = document.getElementById('quarantine-circle-toggle');
  const polygonToggle = document.getElementById('quarantine-toggle');
  
  if (radiusToggle) {
    radiusToggle.checked = true;
  }
  
  if (polygonToggle) {
    polygonToggle.checked = true;
  }

  // Limpiar capas del mapa
  const layersToRemove = [
    'quarantine-points',
    'quarantine-line',
    'quarantine-polygon',
    'temp-quarantine-circle',
    'temp-quarantine-halo',
    'temp-quarantine-outline',
    'temp-quarantine-center',
  ];

  layersToRemove.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }
  });

  // Ocultar capas de cuarentena
  if (map.getLayer('quarantine-circle-layer')) {
    map.setLayoutProperty('quarantine-circle-layer', 'visibility', 'none');
  }
  
  if (map.getLayer('quarantine-layer')) {
    map.setLayoutProperty('quarantine-layer', 'visibility', 'none');
  }
}


// Agregar evento para cuando se carga la página
document.addEventListener('DOMContentLoaded', initializeQuarantineState);

// Agregar evento para cuando se recarga la página
window.addEventListener('beforeunload', () => {
  initializeQuarantineState();
});

document.addEventListener("DOMContentLoaded", function() {
 // console.log('DOM completamente cargado');
  
  const Select = document.getElementById("SelectComuna"); 
  //console.log('Elemento select encontrado:', Select);

  if (Select) { 
      fetch('/quarantines/comuna')  // Asegúrate de que esta URL coincida con la configuración en tu servidor
          .then(response => {
             // console.log('Respuesta recibida:', response);
              return response.json();
          })
          .then(data => {
              //console.log('Datos recibidos:', data);
              if (data.success) {
                  data.comunas.forEach(comuna => {
                      const option = document.createElement("option");
                      option.value = comuna.id_sector;
                      option.textContent = comuna.comuna;
                      Select.appendChild(option);
                      //console.log('Opción agregada:', comuna.comuna);
                  });
                  if (window.enhanceSelect) window.enhanceSelect(Select);
              } else {
                  console.error("Error en los datos:", data.error);
              }
          })
          .catch(error => console.error("Error al cargar las comunas:", error));
  } else {
      console.error("No se encontró el elemento SelectComuna");
  }

  const _qtype = document.getElementById('quarantine-type');
  if (_qtype && window.enhanceSelect) window.enhanceSelect(_qtype);
});

export { quarantinePoints, saveQuarantine, startDrawing, endDrawing, initializeQuarantineState};
// ===========================================================================
//  Experiencia de trazado: animación, ayuda y controles (diseño mejorado)
// ===========================================================================

// ---- Ayuda / contador --------------------------------------------------
function helperEl() { return document.getElementById('trazado-helper'); }

function iniciarAyudaTrazado() {
  const h = helperEl();
  if (h) h.classList.remove('hidden');
  setTrazadoHint('Haz clic en el mapa para agregar puntos (mínimo 3).', false);
  actualizarContador();
}
function ocultarAyudaTrazado() {
  const h = helperEl();
  if (h) h.classList.add('hidden');
}
function setTrazadoHint(msg, isError) {
  const el = document.getElementById('trazado-hint');
  if (!el) return;
  el.innerHTML = '<i class="fas fa-' + (isError ? 'exclamation-circle' : 'hand-pointer') + '"></i> ' + msg;
  el.classList.toggle('is-error', !!isError);
}
function actualizarContador() {
  const c = document.getElementById('trazado-count');
  if (!c) return;
  const n = quarantinePoints.length;
  if (trazadoCerrado) { c.textContent = 'Trazado cerrado · ' + n + ' puntos'; return; }
  c.textContent = (n < 3) ? ('Puntos: ' + n + ' · faltan ' + (3 - n)) : ('Puntos: ' + n + ' · listo para cerrar');
}
function actualizarAyudaTrazado() {
  actualizarContador();
  if (trazadoCerrado) return;
  if (quarantinePoints.length < 3) setTrazadoHint('Haz clic en el mapa para agregar puntos (mínimo 3).', false);
  else setTrazadoHint('Haz clic en el primer punto o en “Cerrar” para terminar.', false);
}

// ---- Primer punto resaltado (para cerrar) ------------------------------
function actualizarPrimerPunto() {
  if (!quarantinePoints.length) return;
  const data = { type: 'Feature', geometry: { type: 'Point', coordinates: quarantinePoints[0].coords } };
  if (!map.getSource('quarantine-first-halo')) {
    map.addSource('quarantine-first-halo', { type: 'geojson', data });
    map.addLayer({ id: 'quarantine-first-halo', type: 'circle', source: 'quarantine-first-halo',
      paint: { 'circle-radius': 9, 'circle-color': TZ_COLOR, 'circle-opacity': 0 } });
  } else { map.getSource('quarantine-first-halo').setData(data); }
  if (!map.getSource('quarantine-first')) {
    map.addSource('quarantine-first', { type: 'geojson', data });
    map.addLayer({ id: 'quarantine-first', type: 'circle', source: 'quarantine-first',
      paint: { 'circle-radius': 7, 'circle-color': TZ_COLOR_DARK, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } });
  } else { map.getSource('quarantine-first').setData(data); }
}

function cercaDelPrimerPunto(screenPoint) {
  if (!quarantinePoints.length) return false;
  const p = map.project(quarantinePoints[0].coords);
  const dx = p.x - screenPoint.x, dy = p.y - screenPoint.y;
  return Math.sqrt(dx * dx + dy * dy) <= 14; // tolerancia en píxeles
}

// ---- Cerrar trazado ----------------------------------------------------
function cerrarTrazado() {
  if (quarantinePoints.length < 3) { setTrazadoHint('Agrega al menos 3 puntos para cerrar.', true); return; }
  if (poligonoSeAutointersecta(quarantinePoints.map(p => p.coords))) {
    setTrazadoHint('Al cerrar, las líneas se cruzarían. Ajusta el trazado.', true);
    return;
  }
  trazadoCerrado = true;
  updateQuarantinePolygon();
  // Cerrar el anillo: la línea ahora incluye el segmento del último al primer punto,
  // quedando del mismo grosor que los demás lados.
  const ringCoords = quarantinePoints.map(p => p.coords);
  ringCoords.push(quarantinePoints[0].coords);
  const ringData = { type: 'Feature', geometry: { type: 'LineString', coordinates: ringCoords } };
  if (map.getSource('quarantine-line')) {
    map.getSource('quarantine-line').setData(ringData);
  } else {
    map.addSource('quarantine-line', { type: 'geojson', data: ringData });
    map.addLayer({ id: 'quarantine-line', type: 'line', source: 'quarantine-line',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': TZ_COLOR, 'line-width': 3 } });
  }
  if (map.getLayer('quarantine-line')) { try { map.setPaintProperty('quarantine-line', 'line-dasharray', [1, 0]); } catch (e) {} }
  limpiarRubber();
  if (map.getLayer('quarantine-first-halo')) { try { map.setPaintProperty('quarantine-first-halo', 'circle-opacity', 0); } catch (e) {} }
  if (map.getCanvas()) map.getCanvas().style.cursor = '';
  setTrazadoHint('Trazado cerrado. Completa el sector y el comentario, y pulsa Guardar.', false);
  actualizarContador();
}

// ---- Segmento elástico (sigue el cursor) -------------------------------
function actualizarRubber(lngLat) {
  if (drawingMode !== 'trazado' || trazadoCerrado || !quarantinePoints.length) { limpiarRubber(); return; }
  const last = quarantinePoints[quarantinePoints.length - 1].coords;
  const cand = [lngLat.lng, lngLat.lat];
  const color = nuevoSegmentoCruza(cand) ? '#dc2626' : TZ_COLOR; // rojo si cruzaría
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: [last, cand] } };
  if (!map.getSource('quarantine-rubber')) {
    map.addSource('quarantine-rubber', { type: 'geojson', data });
    map.addLayer({ id: 'quarantine-rubber', type: 'line', source: 'quarantine-rubber',
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [1.5, 2], 'line-opacity': 0.85 } });
  } else {
    map.getSource('quarantine-rubber').setData(data);
    try { map.setPaintProperty('quarantine-rubber', 'line-color', color); } catch (e) {}
  }
}
function limpiarRubber() {
  if (map.getLayer('quarantine-rubber')) map.removeLayer('quarantine-rubber');
  if (map.getSource('quarantine-rubber')) map.removeSource('quarantine-rubber');
}
map.on('mousemove', (e) => { if (drawingMode === 'trazado') actualizarRubber(e.lngLat); });

// ---- Destello al agregar un punto --------------------------------------
function flashPunto(coords) {
  const data = { type: 'Feature', geometry: { type: 'Point', coordinates: coords } };
  if (!map.getSource('quarantine-flash')) {
    map.addSource('quarantine-flash', { type: 'geojson', data });
    map.addLayer({ id: 'quarantine-flash', type: 'circle', source: 'quarantine-flash',
      paint: { 'circle-radius': 6, 'circle-color': TZ_COLOR, 'circle-opacity': 0.5 } });
  } else { map.getSource('quarantine-flash').setData(data); }
  const t0 = performance.now();
  function step(now) {
    const k = Math.min((now - t0) / 450, 1);
    try {
      map.setPaintProperty('quarantine-flash', 'circle-radius', 6 + k * 22);
      map.setPaintProperty('quarantine-flash', 'circle-opacity', 0.5 * (1 - k));
    } catch (e) {}
    if (k < 1) requestAnimationFrame(step);
    else { if (map.getLayer('quarantine-flash')) map.removeLayer('quarantine-flash'); if (map.getSource('quarantine-flash')) map.removeSource('quarantine-flash'); }
  }
  requestAnimationFrame(step);
}

// ---- Animación: hormigas marchando + pulso del primer punto ------------
const TZ_DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
  [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2],
  [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]
];
let tzDashStep = 0, tzLastDashTs = 0;
function tzAnimar(ts) {
  if (drawingMode !== 'trazado') { trazadoRafId = null; return; }
  trazadoRafId = requestAnimationFrame(tzAnimar);
  if (!trazadoCerrado && map.getLayer('quarantine-line')) {
    if (ts - tzLastDashTs > 55) {
      tzLastDashTs = ts;
      tzDashStep = (tzDashStep + 1) % TZ_DASH_SEQ.length;
      try { map.setPaintProperty('quarantine-line', 'line-dasharray', TZ_DASH_SEQ[tzDashStep]); } catch (e) {}
    }
  }
  if (!trazadoCerrado && quarantinePoints.length >= 3 && map.getLayer('quarantine-first-halo')) {
    const t = (ts % 1500) / 1500;
    try {
      map.setPaintProperty('quarantine-first-halo', 'circle-radius', 9 + t * 12);
      map.setPaintProperty('quarantine-first-halo', 'circle-opacity', 0.5 * (1 - t));
    } catch (e) {}
  }
}
function iniciarAnimacionTrazado() { if (!trazadoRafId) trazadoRafId = requestAnimationFrame(tzAnimar); }
function detenerAnimacionTrazado() { if (trazadoRafId) { cancelAnimationFrame(trazadoRafId); trazadoRafId = null; } }

// ---- Limpieza de capas auxiliares --------------------------------------
function limpiarCapasTrazadoExtra() {
  ['quarantine-rubber', 'quarantine-first', 'quarantine-first-halo', 'quarantine-flash'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
}

// ---- Deshacer / limpiar ------------------------------------------------
function refrescarCapasTrazado() {
  if (!quarantinePoints.length) {
    ['quarantine-points', 'quarantine-line', 'quarantine-polygon'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    return;
  }
  updateQuarantinePoints();
  if (quarantinePoints.length < 2) {
    if (map.getLayer('quarantine-line')) map.removeLayer('quarantine-line');
    if (map.getSource('quarantine-line')) map.removeSource('quarantine-line');
  }
  if (quarantinePoints.length < 3) {
    if (map.getLayer('quarantine-polygon')) map.removeLayer('quarantine-polygon');
    if (map.getSource('quarantine-polygon')) map.removeSource('quarantine-polygon');
  } else {
    updateQuarantinePolygon();
  }
}
function deshacerPunto() {
  if (!quarantinePoints.length) return;
  trazadoCerrado = false;
  quarantinePoints.pop();
  if (map.getLayer('quarantine-line')) { try { map.setPaintProperty('quarantine-line', 'line-dasharray', [0, 4, 3]); } catch (e) {} }
  refrescarCapasTrazado();
  if (quarantinePoints.length) actualizarPrimerPunto(); else limpiarCapasTrazadoExtra();
  actualizarAyudaTrazado();
}
function limpiarTrazado() {
  quarantinePoints = [];
  trazadoCerrado = false;
  ['quarantine-points', 'quarantine-line', 'quarantine-polygon'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
  limpiarCapasTrazadoExtra();
  actualizarAyudaTrazado();
}

// ---- Botones de la barra de ayuda + Escape -----------------------------
function abrirTutorialTrazado() { const t = document.getElementById('trazado-tutorial'); if (t) t.classList.remove('hidden'); }
function cerrarTutorialTrazado() { const t = document.getElementById('trazado-tutorial'); if (t) t.classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', () => {
  const u = document.getElementById('trazado-undo');
  if (u) u.addEventListener('click', deshacerPunto);
  const cl = document.getElementById('trazado-clear');
  if (cl) cl.addEventListener('click', limpiarTrazado);
  const cs = document.getElementById('trazado-close');
  if (cs) cs.addEventListener('click', () => { if (!trazadoCerrado) cerrarTrazado(); });

  // Tutorial
  const tb = document.getElementById('trazado-tutorial-btn');
  if (tb) tb.addEventListener('click', abrirTutorialTrazado);
  const tc = document.getElementById('trazado-tutorial-close');
  if (tc) tc.addEventListener('click', cerrarTutorialTrazado);
  const tk = document.getElementById('trazado-tutorial-ok');
  if (tk) tk.addEventListener('click', cerrarTutorialTrazado);
  const tov = document.getElementById('trazado-tutorial');
  if (tov) tov.addEventListener('click', (e) => { if (e.target === tov) cerrarTutorialTrazado(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const tut = document.getElementById('trazado-tutorial');
    if (tut && !tut.classList.contains('hidden')) { cerrarTutorialTrazado(); return; }
    if (drawingMode) cancelDrawing();
  });
});

// ===========================================================================
//  Validación de auto-intersección del trazado (evita relojes de arena, etc.)
// ===========================================================================
function tzOrient(p, q, r) {
  // Signo del producto cruzado (orientación de 3 puntos)
  return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
}
// ¿Se cruzan "propiamente" los segmentos p1p2 y p3p4? (tocar en un extremo no cuenta)
function segCruza(p1, p2, p3, p4) {
  const d1 = tzOrient(p3, p4, p1);
  const d2 = tzOrient(p3, p4, p2);
  const d3 = tzOrient(p1, p2, p3);
  const d4 = tzOrient(p1, p2, p4);
  return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)));
}
// ¿El nuevo lado (último punto -> candidato) cruza algún lado existente?
function nuevoSegmentoCruza(cand) {
  const n = quarantinePoints.length;
  if (n < 2) return false;
  const last = quarantinePoints[n - 1].coords;
  for (let i = 0; i < n - 1; i++) {
    const a = quarantinePoints[i].coords;
    const b = quarantinePoints[i + 1].coords;
    if (segCruza(last, cand, a, b)) return true;
  }
  return false;
}
// ¿El polígono CERRADO se cruza a sí mismo? (incluye el lado de cierre)
function poligonoSeAutointersecta(pts) {
  const n = pts.length;
  if (n < 4) return false; // un triángulo nunca se autointersecta
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1) continue;            // lados consecutivos (comparten vértice)
      if (i === 0 && j === n - 1) continue; // primer y último lado (comparten v0)
      const c = pts[j], d = pts[(j + 1) % n];
      if (segCruza(a, b, c, d)) return true;
    }
  }
  return false;
}

// ===========================================================================
//  Animación y limpieza de la cuarentena por radio (mismo estilo del trazado)
// ===========================================================================
let radioRafId = null;
let radioDashStep = 0, radioLastDashTs = 0;

function radioAnimar(ts) {
  if (drawingMode !== 'radio') { radioRafId = null; return; }
  radioRafId = requestAnimationFrame(radioAnimar);
  // Contorno: hormigas marchando
  if (map.getLayer('temp-quarantine-outline')) {
    if (ts - radioLastDashTs > 55) {
      radioLastDashTs = ts;
      radioDashStep = (radioDashStep + 1) % TZ_DASH_SEQ.length;
      try { map.setPaintProperty('temp-quarantine-outline', 'line-dasharray', TZ_DASH_SEQ[radioDashStep]); } catch (e) {}
    }
  }
  // Halo del centro: pulso
  if (map.getLayer('temp-quarantine-halo')) {
    const t = (ts % 1600) / 1600;
    try {
      map.setPaintProperty('temp-quarantine-halo', 'circle-radius', 8 + t * 14);
      map.setPaintProperty('temp-quarantine-halo', 'circle-opacity', 0.5 * (1 - t));
    } catch (e) {}
  }
}
function iniciarAnimacionRadio() { if (!radioRafId) radioRafId = requestAnimationFrame(radioAnimar); }
function detenerAnimacionRadio() { if (radioRafId) { cancelAnimationFrame(radioRafId); radioRafId = null; } }

function limpiarCapasRadio() {
  ['temp-quarantine-halo', 'temp-quarantine-outline', 'temp-quarantine-center', 'temp-quarantine-circle'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  });
  quarantineCircle = null;
}

// ===========================================================================
//  Campo "Radio (metros)" y ajuste del radio con la rueda del mouse
// ===========================================================================
function mostrarCampoRadio(mostrar) {
  const f = document.getElementById('radius-field');
  if (f) f.classList.toggle('hidden', !mostrar);
  if (mostrar) {
    const input = document.getElementById('quarantine-radius');
    if (input && (!input.value || parseFloat(input.value) <= 0)) input.value = 1000;
  }
}

// Distancia en metros entre dos coordenadas [lng, lat] (haversine)
function distanciaMetros(a, b) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad, lat2 = b[1] * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Rueda del mouse: si el cursor está dentro del círculo, ajusta el radio
map.on('wheel', (e) => {
  if (drawingMode !== 'radio' || !quarantineCenter) return;

  const rect = map.getCanvas().getBoundingClientRect();
  const x = e.originalEvent.clientX - rect.left;
  const y = e.originalEvent.clientY - rect.top;
  const ll = map.unproject([x, y]);
  const cursor = [ll.lng, ll.lat];

  const input = document.getElementById('quarantine-radius');
  const radio = parseFloat(input.value) || 1000;

  // Solo actuar si el cursor está dentro del círculo (dentro del radio actual)
  if (distanciaMetros(cursor, quarantineCenter) <= radio) {
    e.preventDefault(); // evita que el mapa haga zoom
    const paso = Math.max(50, Math.round(radio * 0.1)); // 10% del radio, mínimo 50 m
    const aumentar = e.originalEvent.deltaY < 0; // scroll hacia arriba = aumentar
    let nuevo = radio + (aumentar ? paso : -paso);
    nuevo = Math.max(50, Math.round(nuevo)); // no bajar de 50 m
    input.value = nuevo;
    updateQuarantineCircle();
  }
});

// ===========================================================================
//  Visualización en el mapa: realce al pasar el mouse (feature-state) y
//  animación ambiente ligera SOLO en cuarentenas activas (plan híbrido).
// ===========================================================================

// Resalta la cuarentena bajo el cursor (una a la vez) y cambia el cursor.
function habilitarHoverCuarentena(layerId, sourceId) {
  let hovered = null;
  map.on('mousemove', layerId, (e) => {
    if (drawingMode || !e.features.length) return;
    map.getCanvas().style.cursor = 'pointer';
    if (hovered !== null) map.setFeatureState({ source: sourceId, id: hovered }, { hover: false });
    hovered = e.features[0].id;
    map.setFeatureState({ source: sourceId, id: hovered }, { hover: true });
  });
  map.on('mouseleave', layerId, () => {
    if (!drawingMode) map.getCanvas().style.cursor = '';
    if (hovered !== null) map.setFeatureState({ source: sourceId, id: hovered }, { hover: false });
    hovered = null;
  });
}
habilitarHoverCuarentena('quarantine-layer', 'quarantine-source');
habilitarHoverCuarentena('quarantine-circle-layer', 'quarantine-circle-source');

// Animación ambiente: el halo de las activas "respira" lentamente.
// Umbral: si hay muchas activas en pantalla, se apaga sola para no pesar.
const Q_AMBIENT_MAX = 40;
let qPulseRaf = null;
function qPulseLoop(ts) {
  qPulseRaf = requestAnimationFrame(qPulseLoop);
  const total = (qCounts.radio || 0) + (qCounts.trazado || 0);
  const activo = total > 0 && total <= Q_AMBIENT_MAX;
  const k = (ts % 2200) / 2200;             // 0..1 repetido (~2.2 s)
  const fade = Math.sin(k * Math.PI);       // entra y sale suave (sin parpadeo)
  const opTraz = activo ? 0.38 * fade : 0;  // trazado: más suave
  const opRadio = activo ? 0.55 * fade : 0; // radio

  // Trazado: aro que engrosa sobre el borde y se desvanece (suave)
  if (map.getLayer('quarantine-pulse')) {
    try {
      map.setPaintProperty('quarantine-pulse', 'line-width', 1 + k * 16);
      map.setPaintProperty('quarantine-pulse', 'line-opacity', opTraz);
    } catch (e) {}
  }
  // Radio: anillo fino que crece en diámetro desde el centro (como el demo)
  if (map.getLayer('quarantine-circle-ping')) {
    try {
      map.setPaintProperty('quarantine-circle-ping', 'circle-radius', 4 + k * 34);
      map.setPaintProperty('quarantine-circle-ping', 'circle-stroke-opacity', opRadio);
    } catch (e) {}
  }
}
qPulseRaf = requestAnimationFrame(qPulseLoop);

// Al cambiar el mapa base (map.js dispara 'basemap:loaded'), re-dibujar las
// cuarentenas activas/inactivas según los toggles (setStyle borró sus capas).
// Las parcelas son marcadores DOM y sobreviven solas.
window.addEventListener('basemap:loaded', () => {
  const t = document.getElementById('quarantine-toggle');
  const c = document.getElementById('quarantine-circle-toggle');
  const i = document.getElementById('quarantine-inactive');
  if (t && t.checked) fetchAndDisplayQuarantines('trazado');
  if (c && c.checked) fetchAndDisplayQuarantines('radio');
  if (i && i.checked) { fetchInactiveRadioQuarantines(); fetchInactiveTrazadoQuarantines(); }
});

// ===========================================================================
//  Activar / desactivar: actualización quirúrgica de UNA cuarentena (mover
//  entre la capa activa e inactiva) con respaldo de refresco si el estado del
//  cliente no calza (versión blindada).
// ===========================================================================

// Respaldo: re-consulta solo las capas que estén encendidas.
function refrescarCapasVisibles() {
  const t = document.getElementById('quarantine-toggle');
  const c = document.getElementById('quarantine-circle-toggle');
  const i = document.getElementById('quarantine-inactive');
  if (t && t.checked) fetchAndDisplayQuarantines('trazado');
  if (c && c.checked) fetchAndDisplayQuarantines('radio');
  if (i && i.checked) { fetchInactiveRadioQuarantines(); fetchInactiveTrazadoQuarantines(); }
}

// Quita una feature por id de una fuente; devuelve la feature removida o null.
function quitarDeFuente(sourceId, id) {
  const src = map.getSource(sourceId);
  if (!src || !src._data || !Array.isArray(src._data.features)) return null;
  let removida = null;
  const restantes = src._data.features.filter(f => {
    if (f.properties && String(f.properties.id) === String(id)) { removida = f; return false; }
    return true;
  });
  if (removida) src.setData({ type: 'FeatureCollection', features: restantes });
  return removida;
}

// Agrega una feature a una fuente existente; devuelve true si pudo.
function agregarAFuente(sourceId, feature) {
  const src = map.getSource(sourceId);
  if (!src || !src._data) return false;
  const feats = (src._data.features || []).slice();
  feats.push(feature);
  src.setData({ type: 'FeatureCollection', features: feats });
  return true;
}

// Re-sincroniza los puntos del anillo "ping" de radio desde la fuente activa.
function sincronizarPingRadio() {
  const src = map.getSource('quarantine-circle-source');
  const ping = map.getSource('quarantine-circle-ping-source');
  if (!src || !src._data || !ping) return;
  const centros = (src._data.features || []).map(f => {
    const ring = f.geometry.coordinates[0];
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < ring.length - 1; i++) { sx += ring[i][0]; sy += ring[i][1]; n++; }
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [sx / n, sy / n] }, properties: {} };
  });
  ping.setData({ type: 'FeatureCollection', features: centros });
}

// ACTIVA -> INACTIVA (al desactivar). false si no estaba donde se esperaba.
function moverADesactivada(id) {
  let tipo = 'radio';
  let feat = quitarDeFuente('quarantine-circle-source', id);
  if (!feat) { tipo = 'trazado'; feat = quitarDeFuente('quarantine-source', id); }
  if (!feat) return false;

  if (qCounts[tipo] > 0) qCounts[tipo]--;
  if (tipo === 'radio') sincronizarPingRadio();

  const inact = document.getElementById('quarantine-inactive');
  if (inact && inact.checked) {
    const clon = JSON.parse(JSON.stringify(feat));
    clon.properties.inactive = true;
    if (!agregarAFuente(`inactive-quarantine-${tipo}-source`, clon)) {
      if (tipo === 'radio') fetchInactiveRadioQuarantines(); else fetchInactiveTrazadoQuarantines();
    }
  }
  return true;
}

// INACTIVA -> ACTIVA (al activar). false si no estaba donde se esperaba.
function moverAActivada(id) {
  let tipo = 'radio';
  let feat = quitarDeFuente('inactive-quarantine-radio-source', id);
  if (!feat) { tipo = 'trazado'; feat = quitarDeFuente('inactive-quarantine-trazado-source', id); }
  if (!feat) return false;

  const ck = document.getElementById(tipo === 'radio' ? 'quarantine-circle-toggle' : 'quarantine-toggle');
  if (ck && ck.checked) {
    const clon = JSON.parse(JSON.stringify(feat));
    delete clon.properties.inactive;
    const activeSource = tipo === 'radio' ? 'quarantine-circle-source' : 'quarantine-source';
    if (agregarAFuente(activeSource, clon)) {
      qCounts[tipo] = (qCounts[tipo] || 0) + 1;
      if (tipo === 'radio') sincronizarPingRadio();
    } else {
      fetchAndDisplayQuarantines(tipo);
    }
  }
  return true;
}
