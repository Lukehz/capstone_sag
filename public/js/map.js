mapboxgl.accessToken = window.MAPBOX_TOKEN || '';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: [-72.9369, -41.4717], // Coordenadas iniciales
  zoom: 11,
  maxZoom: 20,
  minZoom: 1,
  fitBoundsOptions: null,
});

const directions = new MapboxDirections({
  accessToken: mapboxgl.accessToken,
  language: 'es',
  controls: {
    inputs: false
  },
  interactive: false, // Desactiva la selección interactiva del punto B
  
});



map.addControl(directions, 'bottom-left');




// Coordenadas para centrar el mapa (modifica según tus necesidades)
const mainLocation = [-72.9369, -41.4717];

// Función para centrar el mapa en las coordenadas principales
document.getElementById('center-map').addEventListener('click', () => {
  map.flyTo({
    center: mainLocation,
    essential: true, // Este parámetro asegura que el vuelo se reproduzca en un navegador móvil
    zoom: 11, // Puedes ajustar el nivel de zoom que desees
    speed: 1, // Velocidad de animación
    curve: 1, // Curva de la animación
    easing: (t) => t, // Easing de la animación
  });
});

// Función de geocodificación
const coordinatesGeocoder = function (query) {
  const matches = query.match(/^(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)$/);
  if (!matches) return null;

  function coordinateFeature(lng, lat) {
    return {
      center: [lng, lat],
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      place_name: `Lat: ${lat} Lng: ${lng}`,
      place_type: ['coordinate'],
      properties: {},
      type: 'Feature',
    };
  };

  const coord1 = Number(matches[1]);
  const coord2 = Number(matches[2]);
  const geocodes = [];

  if (Math.abs(coord1) <= 90 && Math.abs(coord2) <= 180) {
    geocodes.push(coordinateFeature(coord2, coord1));
  }

  if (Math.abs(coord1) <= 180 && Math.abs(coord2) <= 90) {
    geocodes.push(coordinateFeature(coord1, coord2));
  }

  return geocodes;
};

// Configuración del control del buscador
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  localGeocoder: coordinatesGeocoder, // Habilita búsqueda de coordenadas
  placeholder: 'Ingrese coordenadas o lugar', // Cambia el texto del placeholder
  mapboxgl: mapboxgl, // Necesario para la integración
  reverseGeocode: true, // Habilita búsqueda inversa (lat/lng)
});

// Asigna el buscador al contenedor específico
document.getElementById('map-search').appendChild(geocoder.onAdd(map));


// ===== Selector de mapa base (botón colapsable, abajo a la derecha) =====
const BASEMAPS = [
  { id: 'satellite-streets-v12', label: 'Satélite', icon: 'fa-satellite' },
  { id: 'streets-v12',           label: 'Calles',   icon: 'fa-road' },
  { id: 'outdoors-v12',          label: 'Terreno',  icon: 'fa-mountain' },
];
let basemapActual = 'satellite-streets-v12';
let primeraCargaEstilo = true;

class BasemapSwitcher {
  onAdd(m) {
    this._map = m;
    const c = document.createElement('div');
    c.className = 'mapboxgl-ctrl basemap-switcher';

    // Panel con las opciones (se muestra al abrir)
    const panel = document.createElement('div');
    panel.className = 'basemap-switcher__panel';
    BASEMAPS.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.style = b.id;
      btn.className = 'basemap-switcher__btn' + (b.id === basemapActual ? ' is-active' : '');
      btn.innerHTML = `<i class="fas ${b.icon}"></i><span class="basemap-switcher__label">${b.label}</span>`;
      btn.addEventListener('click', () => {
        c.classList.remove('is-open');
        if (b.id === basemapActual) return;
        basemapActual = b.id;
        panel.querySelectorAll('.basemap-switcher__btn').forEach(x =>
          x.classList.toggle('is-active', x.dataset.style === b.id));
        m.setStyle('mapbox://styles/mapbox/' + b.id);
      });
      panel.appendChild(btn);
    });

    // Botón con ícono de capas que abre/cierra el panel
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'basemap-switcher__toggle';
    toggle.title = 'Cambiar mapa';
    toggle.innerHTML = '<i class="fas fa-layer-group"></i>';
    toggle.addEventListener('click', (e) => { e.stopPropagation(); c.classList.toggle('is-open'); });

    // Cerrar al hacer clic fuera del control
    this._docClick = (ev) => { if (!c.contains(ev.target)) c.classList.remove('is-open'); };
    document.addEventListener('click', this._docClick);

    c.appendChild(panel);
    c.appendChild(toggle);
    this._container = c;
    return c;
  }
  onRemove() {
    document.removeEventListener('click', this._docClick);
    this._container.parentNode.removeChild(this._container);
  }
}

map.addControl(new BasemapSwitcher(), 'bottom-right');

// setStyle borra las capas personalizadas; al cargar el nuevo estilo avisamos
// para volver a dibujarlas. La PRIMERA carga la maneja el flujo normal de la app.
map.on('style.load', () => {
  if (primeraCargaEstilo) { primeraCargaEstilo = false; return; }
  window.dispatchEvent(new Event('basemap:loaded'));
});

export { map, directions };