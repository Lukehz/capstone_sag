// Importa el mapa
import { map, directions } from './map.js';

// Obtener el contenedor del dropdown
const dropdown = document.getElementById('parcelas-dropdown');
const cancelButton = document.getElementById('cancel-directions');

document.addEventListener('DOMContentLoaded', () => {
  obtenerParcelas();
  // Escuchar cambios en el dropdown
  dropdown.addEventListener('change', manejarSeleccionParcela);
  cancelButton.addEventListener('click', cancelarVisualizacion);
});

function cancelarVisualizacion() {
  // Limpiar las direcciones usando el control de direcciones
  directions.removeRoutes();
  
 // console.log('Ruta eliminada del mapa');
}


// Función para obtener parcelas desde la API
async function obtenerParcelas() {
  try {
    const response = await fetch('/api/get-comuna/parcelas');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const parcelas = await response.json();
    // Llenar el dropdown con las parcelas agrupadas por comuna
    llenarDropdownConParcelasAgrupadas(parcelas);
    // Generar listado de parcelas en el acordeón

    // Generar el acordeón con las parcelas agrupadas por comuna
    generarListadoParcelasPorComuna(parcelas);
    return parcelas;
  } catch (error) {
    console.error('Error al obtener parcelas:', error.message);
    throw error;
  }
}

// Función para llenar el dropdown con las parcelas agrupadas por comuna
function llenarDropdownConParcelasAgrupadas(parcelas) {
  dropdown.innerHTML = '<option value="">Seleccione una parcela</option>'; // Limpia el dropdown

  const comunas = parcelas.reduce((acc, parcela) => {
    const { comuna } = parcela;
    if (!acc[comuna]) acc[comuna] = [];
    acc[comuna].push(parcela);
    return acc;
  }, {});

  Object.keys(comunas)
    .sort()
    .forEach(comuna => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = comuna;

      comunas[comuna].forEach(parcela => {
        const option = document.createElement('option');
        option.value = parcela.id_parcelacion;
        option.textContent = `Parcela ${parcela.id_parcelacion} - ${parcela.cultivo}`;
        option.setAttribute('data-lat', parcela.latitud);
        option.setAttribute('data-lng', parcela.longitud);
        optgroup.appendChild(option);
      });

      dropdown.appendChild(optgroup);
    });

  if (window.enhanceSelect) window.enhanceSelect(dropdown);
}

// Función para generar el listado de parcelas agrupadas por comuna en un acordeón
function generarListadoParcelasPorComuna(parcelas) {
  const panel = document.getElementById('parcelacion-panel');
  if (panel) {
    panel.innerHTML = ''; // Limpia el panel antes de agregar nuevo contenido

    // Agrupar las parcelas por comuna
    const comunas = parcelas.reduce((acc, parcela) => {
      const { comuna } = parcela;
      if (!acc[comuna]) acc[comuna] = [];
      acc[comuna].push(parcela);
      return acc;
    }, {});

    // Crear los elementos del acordeón por cada comuna
    Object.keys(comunas).sort().forEach(comuna => {
      // Crear el botón de acordeón para la comuna
      const comunaAccordion = document.createElement('button');
      comunaAccordion.classList.add('accordion');
      comunaAccordion.textContent = `${comuna} (${comunas[comuna].length})`;

      // Crear el panel asociado al acordeón
      const parcelaPanel = document.createElement('div');
      parcelaPanel.classList.add('panel');

      // Crear la lista de parcelas dentro del panel
      const listaParcelas = document.createElement('ul');
      comunas[comuna].forEach(parcela => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="parcela-link" data-id="${parcela.id_parcelacion}" data-lat="${parcela.latitud}" data-lng="${parcela.longitud}">
            Parcela ${parcela.id_parcelacion} - Cultivo: ${parcela.cultivo}
          </span>
        `;
        listaParcelas.appendChild(li);
      });

      parcelaPanel.appendChild(listaParcelas);
      panel.appendChild(comunaAccordion);
      panel.appendChild(parcelaPanel);

      // Añadir funcionalidad de acordeón a cada comuna
      comunaAccordion.addEventListener('click', function() {
        this.classList.toggle('active');
        const panel = this.nextElementSibling;
        panel.style.maxHeight = panel.style.maxHeight ? null : panel.scrollHeight + 'px';
      });
    });
  }
}

// Manejar selección de parcela

function manejarSeleccionParcela(event) {
  const selectedOption = dropdown.options[dropdown.selectedIndex];

  if (!selectedOption || !selectedOption.dataset.lat || !selectedOption.dataset.lng) {
    return; // Si no se selecciona una parcela válida
  }

  const destLat = parseFloat(selectedOption.dataset.lat);
  const destLng = parseFloat(selectedOption.dataset.lng);

  if (!isNaN(destLat) && !isNaN(destLng)) {
    // Usar MapboxDirections para calcular y mostrar la ruta
    mostrarRuta(destLat, destLng);
  }
}

// Función para calcular y mostrar la ruta
async function mostrarRuta(destLat, destLng) {
  // Mostrar indicador de carga
  const loadingIndicator = document.getElementById('loading-route');
  if (loadingIndicator) loadingIndicator.style.display = 'block';

  // Obtener la ubicación actual del usuario
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const origen = [position.coords.longitude, position.coords.latitude];
      const destino = [destLng, destLat];

      try {
        // Usar la API Directions de Mapbox
        const modes = ["driving", "walking", "cycling", "driving-traffic"];
        const selectedMode = modes[1]; // Cambia el índice según el modo seleccionado por el usuario

        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/${selectedMode}/${origen.join(',')};${destino.join(',')}?geometries=geojson&access_token=pk.eyJ1Ijoibmljb2xlODAxIiwiYSI6ImNtMHdvdGE3MzAzbnQybG93aXRncnlqb2QifQ.9G8XyYyv4V1b0OJGRnpEZA`
        );
        if (!response.ok) {
          throw new Error('Error al obtener datos de dirección');
        }

        const data = await response.json();
        const route = data.routes[0].geometry;


        // Centrar el mapa en la ruta
        const bounds = new mapboxgl.LngLatBounds();
        route.coordinates.forEach(coord => bounds.extend(coord));
        map.fitBounds(bounds, { padding: 20, maxZoom: 12 });

        // Usar el control de direcciones para actualizar origen/destino
        directions.setOrigin(origen); // Configurar el origen dinámicamente
        directions.setDestination(destino); // Configurar el destino dinámicamente

        // Ocultar indicador de carga
        if (loadingIndicator) loadingIndicator.style.display = 'none';

      } catch (error) {
        console.error('Error al mostrar la ruta:', error);
        window.notify('No se pudo calcular la ruta. Verifique su conexión o permisos de ubicación.');
        
        // Ocultar indicador de carga en caso de error
        if (loadingIndicator) loadingIndicator.style.display = 'none';
      }
    }, (error) => {
      console.error('Error al obtener la ubicación:', error);
      window.notify('No se pudo obtener su ubicación actual. Verifique los permisos de ubicación.');
      
      // Ocultar indicador de carga en caso de error
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    });
  } else {
    window.notify('La geolocalización no está soportada en este navegador.');
    
    // Ocultar indicador de carga
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

// Cargar las parcelas al iniciar la página
obtenerParcelas();



// ------------------------------------------CUARENTENAS ACTIVAS----------------------------------------------------------------

// CUARENTENAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

// Variables globales
let cuarentenasEnMapa = []; // Arreglo para mantener referencia a las cuarentenas en el mapa
let cuarentenaActiva = 1; // Para mantener un registro de la cuarentena actualmente seleccionada

const dropdownCuarentenas = document.getElementById('cuarentenas-dropdown');


async function obtenerCuarentenas() {
  try {
    console.log('Intentando obtener cuarentenas...');
    const response = await fetch('/quarantines/get-comentario');
    
    console.log('Respuesta recibida:', response);
    
    if (!response.ok) {
      console.error(`Error en la respuesta. Status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const cuarentenas = await response.json();
    
    console.log('Cuarentenas obtenidas:', cuarentenas);
    
    if (cuarentenas.length === 0) {
      console.warn('No se encontraron cuarentenas');
    }
    
    return cuarentenas;
  } catch (error) {
    console.error('Error detallado al obtener cuarentenas:', error);
    throw error;
  }
}

// Función para llenar el dropdown con las cuarentenas agrupadas por zona
function llenarDropdownConCuarentenasAgrupadas(cuarentenas) {
  dropdownCuarentenas.innerHTML = '<option value="">Seleccione una cuarentena</option>'; 

  const zonas = cuarentenas.reduce((acc, cuarentena) => {
    const zona = cuarentena.comuna || 'Sin zona';
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(cuarentena);
    return acc;
  }, {});

  Object.keys(zonas).sort().forEach(zona => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = zona;

    zonas[zona].forEach(cuarentena => {
      const option = document.createElement('option');
      option.value = cuarentena.id_cuarentena;
      option.textContent = `Cuarentena ${cuarentena.id_cuarentena} - ${cuarentena.comentario || 'Sin comentario'}`;
      option.setAttribute('data-lat', cuarentena.latitud);
      option.setAttribute('data-lng', cuarentena.longitud);
      optgroup.appendChild(option);
    });

    dropdownCuarentenas.appendChild(optgroup);
  });

  if (window.enhanceSelect) window.enhanceSelect(dropdownCuarentenas);
}

// Función para generar el listado de cuarentenas por comentario
function generarListadoCuarentenasPorComentario(cuarentenas) {
  const panel = document.getElementById('cuarentena-panel');
  if (!panel) {
    console.error('No se encontró el panel de cuarentenas');
    return;
  }
  panel.innerHTML = '';

  const zonas = {}; 

  cuarentenas.forEach(cuarentena => {
    const comentario = cuarentena.comentario || 'Sin comentario';
    const zona = cuarentena.comuna || 'Sin zona';

    if (!zonas[zona]) {
      zonas[zona] = [];
    }
    zonas[zona].push(cuarentena);
  });

  const acordeonGeneral = document.createElement('button');
  acordeonGeneral.classList.add('accordion');
  acordeonGeneral.textContent = `Cuarentenas (${Object.keys(zonas).length} zonas)`;

  const acordeonPanel = document.createElement('div');
  acordeonPanel.classList.add('panel');

  Object.keys(zonas).forEach(zona => {
    const zonaAccordion = document.createElement('button');
    zonaAccordion.classList.add('accordion');
    zonaAccordion.textContent = `${zona} (${zonas[zona].length} cuarentenas)`;

    const zonaPanel = document.createElement('div');
    zonaPanel.classList.add('panel');

    zonaAccordion.addEventListener('click', function () {
      this.classList.toggle('active');
      const panel = this.nextElementSibling;

      zonaPanel.innerHTML = '';

      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        zonas[zona].forEach(cuarentena => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="cuarentena-link" data-id="${cuarentena.id_cuarentena}" data-lat="${cuarentena.latitud}" data-lng="${cuarentena.longitud}">
              Cuarentena ${cuarentena.id_cuarentena} - Comentario: ${cuarentena.comentario || 'Sin comentario'}
            </span>
          `;
          zonaPanel.appendChild(li);
        });
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });

    acordeonPanel.appendChild(zonaAccordion);
    acordeonPanel.appendChild(zonaPanel);
  });

  panel.appendChild(acordeonGeneral);
  panel.appendChild(acordeonPanel);

  acordeonGeneral.addEventListener('click', function () {
    this.classList.toggle('active');
    acordeonPanel.style.maxHeight = acordeonPanel.style.maxHeight ? null : acordeonPanel.scrollHeight + 'px';
  });
}

function volarACuarentenaDesdeDropdown(id, lat, lng) {
  try {
    // Limpiar cuarentenas existentes
    cuarentenasEnMapa.forEach(cuarentena => {
      map.removeLayer(cuarentena.layer);
      map.removeSource(cuarentena.source);
    });
    cuarentenasEnMapa = []; 

    // Volar a la ubicación
    map.flyTo({
      center: [lng, lat],
      zoom: 15,
      essential: true
    });

    const sourceId = `cuarentena-${id}`;
    const layerId = `cuarentena-layer-${id}`;

    map.addSource(sourceId, {
      'type': 'geojson',
      'data': {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [lng, lat]
        }
      }
    });

    map.addLayer({
      'id': layerId,
      'type': 'circle',
      'source': sourceId,
      'paint': {
        'circle-radius': 10,
        'circle-color': '#FF0000'
      }
    });

    // Guardar la cuarentena en el array
    cuarentenasEnMapa.push({ source: sourceId, layer: layerId });

  } catch (error) {
    console.error('Error al volar a la cuarentena:', error);
  }
}

dropdownCuarentenas.addEventListener('change', function() {
  const selectedOption = dropdownCuarentenas.options[dropdownCuarentenas.selectedIndex];
  const id = selectedOption.value;
  const lat = parseFloat(selectedOption.getAttribute('data-lat'));
  const lng = parseFloat(selectedOption.getAttribute('data-lng'));

  if (id) {
    volarACuarentenaDesdeDropdown(id, lat, lng);
  }
});

// Función para inicializar la aplicación y cargar cuarentenas
async function init() {
  try {
    console.log('Inicializando aplicación de cuarentenas...');
    const cuarentenas = await obtenerCuarentenas();
    console.log('Cuarentenas recibidas:', cuarentenas);
    
    generarListadoCuarentenasPorComentario(cuarentenas);
    llenarDropdownConCuarentenasAgrupadas(cuarentenas);
  } catch (error) {
    console.error('Error en la inicialización completa:', error);
  }
}
// Inicializar la aplicación cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', init);


// ------------------------------------------CUARENTENAS INACTIVAS----------------------------------------------------------------

// Variables globales para cuarentenas inactivas
let cuarentenasInactivas = []; // Arreglo para almacenar las cuarentenas inactivas
const dropdownCuarentenasInactivas = document.getElementById('cuarentenas-inactivas-dropdown');

// Función para obtener cuarentenas inactivas desde la API
async function obtenerCuarentenasInactivas() {
  try {
    const response = await fetch('/quarantines/inactiva/comentario');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const cuarentenas = await response.json();
    return cuarentenas.filter(cuarentena => !cuarentena.activa); // Filtrar solo las inactivas
  } catch (error) {
    console.error('Error al obtener cuarentenas inactivas:', error.message);
    throw error;
  }
}

// Función para llenar el dropdown con las cuarentenas inactivas agrupadas por zona
function llenarDropdownConCuarentenasInactivasAgrupadas(cuarentenas) {
  dropdownCuarentenasInactivas.innerHTML = '<option value="">Seleccione una cuarentena inactiva</option>'; // Limpia el dropdown

  // Agrupar las cuarentenas por zona (usando comuna)
  const zonas = cuarentenas.reduce((acc, cuarentena) => {
    const zona = cuarentena.comuna || 'Sin zona';
    if (!acc[zona]) acc[zona] = [];
    acc[zona].push(cuarentena);
    return acc;
  }, {});

  // Ordenar las zonas alfabéticamente
  Object.keys(zonas).sort().forEach(zona => {
    // Crear el grupo de opciones para la zona
    const optgroup = document.createElement('optgroup');
    optgroup.label = zona;

    // Agregar las cuarentenas de esta zona al grupo
    zonas[zona].forEach(cuarentena => {
      const option = document.createElement('option');
      option.value = cuarentena.id_cuarentena;
      option.textContent = `Cuarentena ${cuarentena.id_cuarentena} - ${cuarentena.comentario || 'Sin comentario'}`;
      option.setAttribute('data-lat', cuarentena.latitud);
      option.setAttribute('data-lng', cuarentena.longitud);
      optgroup.appendChild(option);
    });

    dropdownCuarentenasInactivas.appendChild(optgroup);
  });

  if (window.enhanceSelect) window.enhanceSelect(dropdownCuarentenasInactivas);
}

// Función para generar el listado de cuarentenas inactivas por comentario
function generarListadoCuarentenasInactivasPorComentario(cuarentenas) {
  const panel = document.getElementById('cuarentena-inactiva-panel');
  if (!panel) {
    console.error('No se encontró el panel de cuarentenas inactivas');
    return;
  }
  panel.innerHTML = '';

  const zonas = {}; // Agrupar por zona

  // Agrupar las cuarentenas por zona
  cuarentenas.forEach(cuarentena => {
    const comentario = cuarentena.comentario || 'Sin comentario';
    const zona = cuarentena.comuna || 'Sin zona';

    if (!zonas[zona]) {
      zonas[zona] = [];
    }
    zonas[zona].push(cuarentena);
  });

  // Crear un acordeón principal que englobe todas las zonas
  const acordeonGeneral = document.createElement('button');
  acordeonGeneral.classList.add('accordion');
  acordeonGeneral.textContent = `Cuarentenas Inactivas (${Object.keys(zonas).length} zonas)`;

  const acordeonPanel = document.createElement('div');
  acordeonPanel.classList.add('panel');

  // Crear los elementos del sidebar por cada zona
  Object.keys(zonas).forEach(zona => {
    const zonaAccordion = document.createElement('button');
    zonaAccordion.classList.add('accordion');
    zonaAccordion.textContent = `${zona} (${zonas[zona].length} cuarentenas)`;

    const zonaPanel = document.createElement('div');
    zonaPanel.classList.add('panel');

    zonas[zona].forEach(cuarentena => {
      const cuarentenaItem = document.createElement('div');
      cuarentenaItem.classList.add('cuarentena-item');
      cuarentenaItem.textContent = `Cuarentena ${cuarentena.id_cuarentena} - ${cuarentena.comentario || 'Sin comentario'}`;
      cuarentenaItem.addEventListener('click', () => {
        // Al hacer clic, centramos el mapa en la cuarentena seleccionada
        centrarEnCuarentena(cuarentena.latitud, cuarentena.longitud);
      });
      zonaPanel.appendChild(cuarentenaItem);
    });

    // Añadir los elementos de zona al acordeón principal
    acordeonPanel.appendChild(zonaAccordion);
    acordeonPanel.appendChild(zonaPanel);
  });

  // Agregar la lógica del acordeón al botón principal
  acordeonGeneral.addEventListener('click', () => {
    acordeonGeneral.classList.toggle('active');
    const panel = acordeonGeneral.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    }
  });

  // Añadir el acordeón general al panel principal
  panel.appendChild(acordeonGeneral);
  panel.appendChild(acordeonPanel);

  // Lógica de estilo para los acordeones secundarios
  const acordeones = panel.querySelectorAll('.accordion');
  acordeones.forEach(acordeon => {
    acordeon.addEventListener('click', () => {
      acordeon.classList.toggle('active');
      const panel = acordeon.nextElementSibling;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      }
    });
  });
}


function volarACuarentenaInactivasDesdeDropdown(id, lat, lng) {
  //console.log(`Volando a cuarentena ID: ${id}, Lat: ${lat}, Lng: ${lng}`);
  
  try {
    // Limpiar cuarentenas existentes
    cuarentenasEnMapa.forEach(cuarentena => {
      map.removeLayer(cuarentena.layer);
      map.removeSource(cuarentena.source);
    });
    cuarentenasEnMapa = []; // Reiniciar el array

    // Volar a la ubicación
    map.flyTo({
      center: [lng, lat],
      zoom: 15,
      essential: true
    });

    // Agregar marcador de la cuarentena
    const sourceId = `cuarentena-${id}`;
    const layerId = `cuarentena-layer-${id}`;

    map.addSource(sourceId, {
      'type': 'geojson',
      'data': {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [lng, lat]
        }
      }
    });

    map.addLayer({
      'id': layerId,
      'type': 'circle',
      'source': sourceId,
      'paint': {
        'circle-radius': 10,
        'circle-color': '#FF0000' // Color rojo para destacar
      }
    });

    // Guardar la cuarentena en el array
    cuarentenasEnMapa.push({ source: sourceId, layer: layerId });

  } catch (error) {
    console.error('Error al volar a la cuarentena:', error);
  }
}


dropdownCuarentenasInactivas.addEventListener('change', function() {
  const selectedOption = dropdownCuarentenasInactivas.options[dropdownCuarentenasInactivas.selectedIndex];
  const id = selectedOption.value;
  const lat = parseFloat(selectedOption.getAttribute('data-lat'));
  const lng = parseFloat(selectedOption.getAttribute('data-lng'));

  if (id) {
    volarACuarentenaInactivasDesdeDropdown(id, lat, lng);
  }
});

// Inicializar y cargar datos de cuarentenas inactivas
(async function iniciarInactivas() {
  try {
    cuarentenasInactivas = await obtenerCuarentenasInactivas();
    llenarDropdownConCuarentenasInactivasAgrupadas(cuarentenasInactivas);
    generarListadoCuarentenasInactivasPorComentario(cuarentenasInactivas);
  } catch (error) {
    console.error('Error al inicializar cuarentenas inactivas:', error);
  }
})();


function cancelarZoomYRestablecer(dropdownId) {
  try {
    // Remove any existing cuarentena layers from the map
    cuarentenasEnMapa.forEach(cuarentena => {
      if (map.getLayer(cuarentena.layer)) {
        map.removeLayer(cuarentena.layer);
      }
      if (map.getSource(cuarentena.source)) {
        map.removeSource(cuarentena.source);
      }
    });
    
    // Clear the cuarentenasEnMapa array
    cuarentenasEnMapa = [];

    // Reset map view to initial state
    map.flyTo({
      center: [-72.9369, -41.4717], // Replace with your initial map center coordinates
      zoom: 12, // Initial zoom level
      essential: true
    });

    // Reset the dropdown
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      dropdown.selectedIndex = 0; // Reset to the first option (usually a placeholder)
      console.log(`Dropdown "${dropdownId}" reset successfully.`);
    } else {
      console.error(`Dropdown with ID "${dropdownId}" not found.`);
    }

  } catch (error) {
    console.error('Error in cancelarZoomYRestablecer:', error);
  }
}

document.getElementById('cancel-cuarentenas').addEventListener('click', () => {
  cancelarZoomYRestablecer('cuarentenas-dropdown');
});

document.getElementById('cancel-inactivas').addEventListener('click', () => {
  cancelarZoomYRestablecer('cuarentenas-inactivas-dropdown');
});