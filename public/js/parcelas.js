import { map } from './map.js';

let parcelaMarkers = [];

/* */ 

const updateParcelas = () => {
  fetch('/parcelas')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error HTTP! estado: ${response.status}`);
      }
      return response.json();
    })
    .then(parcelas => {
      if (!parcelas.length) {
        return;
      }

      // Limpiar marcadores existentes
      parcelaMarkers.forEach(marker => marker.remove());
      parcelaMarkers = [];

      const bounds = new mapboxgl.LngLatBounds();
      parcelas.forEach(parcela => {
        const lat = parcela.latitud;
        const lng = parcela.longitud;
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          const _esReg = parcela.Registrada === 'Registrada';
          const _el = document.createElement('div');
          _el.className = 'parcela-marker ' + (_esReg ? 'is-ok' : 'is-warn');
          _el.innerHTML = '<span class="parcela-marker__ring"></span><span class="parcela-marker__pin"><i class="fas fa-seedling"></i></span>';
          const marker = new mapboxgl.Marker({ element: _el, anchor: 'bottom' })
          .setLngLat([parcela.longitud, parcela.latitud])
          .setPopup(new mapboxgl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(`
            <div class="lm-popup">
              <div class="lm-popup__head">
                <span class="lm-popup__title"><i class="fas fa-seedling"></i> Parcela #${parcela.ID}</span>
                <span class="lm-popup__badge ${parcela.Registrada === 'Registrada' ? 'is-ok' : 'is-warn'}">${parcela.Registrada}</span>
              </div>
              <div class="lm-popup__body">
                <div class="lm-popup__row"><span><i class="fas fa-layer-group"></i> Fase</span><b>${parcela.Fase}</b></div>
                <div class="lm-popup__row"><span><i class="fas fa-leaf"></i> Cultivo</span><b>${parcela.Cultivo}</b></div>
                <div class="lm-popup__row"><span><i class="fas fa-map-marker-alt"></i> Comuna</span><b>${parcela.Comuna}</b></div>
                <div class="lm-popup__row"><span><i class="fas fa-location-arrow"></i> Coords</span><b>${Number(parcela.latitud).toFixed(5)}, ${Number(parcela.longitud).toFixed(5)}</b></div>
              </div>
              <div class="lm-popup__actions">
                ${(window.Perm && window.Perm.tieneCapacidad('parcelacion.eliminar')) ? '<button id="delete-btn-'+parcela.ID+'" class="close-btn lm-popup__btn lm-popup__btn--danger"><i class="fas fa-trash"></i> Eliminar</button>' : ''}
              </div>
            </div>
          `))
          .addTo(map);
          
          // Agregar event listener cuando el popup se abra
  marker.getPopup().on('open', () => {
    const deleteButton = document.getElementById(`delete-btn-${parcela.ID}`);
    if (deleteButton) {
      deleteButton.addEventListener('click', function() {
        eliminarParcela(parcela.ID, deleteButton);
        updateParcelas();
      });
    }
  });
          parcelaMarkers.push(marker); // Agregar el marcador al array
          bounds.extend([parcela.longitud, parcela.latitud]); // Ajustar los límites del mapa
        }
      });
    })
    .catch(error => console.error('Error al obtener parcelas:', error));
};

// Función para alternar la visibilidad de las parcelas
function toggleParcelas() {
  const isVisible = this.checked; // Obtener estado del checkbox
  
  if (isVisible) {
    updateParcelas(); // Actualizar y mostrar parcelas si está marcado
  } else {
    // Si no está marcado, eliminar todos los marcadores
    parcelaMarkers.forEach(marker => marker.remove());
    parcelaMarkers = [];
  }
}

// Evento de carga de DOM
document.addEventListener('DOMContentLoaded', () => {
  const parcelaCheckbox = document.getElementById('parcela-toggle');
  // Activado por defecto al ingresar a la página
  parcelaCheckbox.checked = true;
  parcelaCheckbox.addEventListener('change', toggleParcelas); // Agregar evento al checkbox
  // Mostrar las parcelas apenas el mapa esté listo
  if (parcelaCheckbox.checked) {
    if (map.loaded()) updateParcelas();
    else map.on('load', () => updateParcelas());
  }
});

// Mapa para almacenar los marcadores por ID de parcela
const markerMap = new Map();

function eliminarParcela(idParcela, boton) {
  fetch(`/parcelas/delete-parcela/${idParcela}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(response => {
      if (response.ok) {
        window.notify("Parcela eliminada correctamente.");
        boton.parentElement.style.display = 'none'; // Oculta el recuadro del mapa

        updateParcelas(); 

        // Eliminar el marcador del mapa si existe
        const marker = markerMap.get(idParcela);
        if (marker) {
          marker.remove(); // Elimina el marcador del mapa
          markerMap.delete(idParcela); // Limpia la referencia en el mapa
        }
      } else {
        // Captura el error del backend y muéstralo en la consola
        return response.text().then(text => { throw new Error(text); });
      }
    })
    .catch(error => {
      console.error("Error al eliminar la parcela:", error.message); // Mostrar el error detallado
      window.notify("No se pudo eliminar la parcela. Intenta nuevamente.");
    });
}

// Variable para indicar si estamos en modo de creación de parcela
let isCreatingParcela = false;

// Al hacer clic en el botón, activar el modo de creación de parcela
document.getElementById('create-parcela').addEventListener('click', () => {
  isCreatingParcela = true;
});

let currentMarker = null;

// Detectar clic en el mapa para obtener las coordenadas
map.on('click', (e) => {
  if (isCreatingParcela) {
    const lat = e.lngLat.lat;
    const lng = e.lngLat.lng;

    // Rellenar los campos de latitud y longitud
    document.getElementById('latitud').value = lat;
    document.getElementById('longitud').value = lng;

    // Si ya existe un marcador previo, eliminarlo
    if (currentMarker) {
      currentMarker.remove();
    }

    // Agregar un nuevo marcador al mapa
    currentMarker = new mapboxgl.Marker()
      .setLngLat([lng, lat]) // Coordenadas del clic
      .addTo(map); // Añadir marcador al mapa
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/parcelas/api/DataOptions');
    if (!response.ok) {
      throw new Error('Error al obtener los datos de la base de datos');
    }
    const data = await response.json();
    if (data.success) {
      // Poblar los selectores de forma independiente
      cargarComunas(data.data.comunas);
      cargarFases(data.data.fases);
      cargarCultivos(data.data.cultivos);
    } else {
      console.error('Error: los datos no son válidos.', data);
    }
  } catch (error) {
    console.error('Error en la obtención de datos:', error);
  }
});
// Funciones separadas para cada selector
function cargarComunas(comunas) {
  populateSelect('SelectComunaModal', comunas);
}
function cargarFases(fases) {
  populateSelect('SelectFase', fases);
}
function cargarCultivos(cultivos) {
  populateSelect('SelectCultivo', cultivos);
}

function populateSelect(selectId, options) {
  // Verificar si el elemento select existe en el DOM
  const selectElement = document.getElementById(selectId);
  if (!selectElement) {
    console.error(`ERROR: Elemento con id "${selectId}" no encontrado en el DOM.`);
    return;
  } else {
  }

  // Verificar si las opciones son válidas
  if (!options || !Array.isArray(options) || options.length === 0) {
    console.warn(`ADVERTENCIA: No se encontraron opciones válidas para el select con id "${selectId}".`);
    return;
  } else {
  }

  // Limpia las opciones previas del select
  selectElement.innerHTML = '<option value="">Seleccionar </option>';
  // Procesar y agregar las opciones al select
  options.forEach((option, index) => {
    try {
      const opt = document.createElement('option');
      // Configuración específica para cada tipo de select
      if (selectId === 'SelectComunaModal') {
        const selectElement = document.getElementById('SelectComunaModal');
        opt.value = option.id_sector || '';
        opt.textContent = option.comuna || 'Sin nombre';
        if (!option.id_sector || !option.comuna) {
          console.warn(`Opción incompleta detectada:`, option);
        }      
      } else if (selectId === 'SelectFase') {
        if (!option.id_fase || !option.nombre) {
          throw new Error(`Datos incompletos para la opción en index ${index}:`, option);
        }
        opt.value = option.id_fase;
        opt.textContent = option.nombre;
      } else if (selectId === 'SelectCultivo') {
        if (!option.id_cultivo || !option.nombre) {
          throw new Error(`Datos incompletos para la opción en index ${index}:`, option);
        }
        opt.value = option.id_cultivo;
        opt.textContent = option.nombre;
      }
      // Añadir la opción al select
      selectElement.appendChild(opt);
    } catch (error) {
      console.error(`ERROR: Problema al procesar la opción en index ${index} para "${selectId}":`, error.message);
    }
  });

  if (window.enhanceSelect) window.enhanceSelect(selectElement);
}

document.addEventListener('DOMContentLoaded', () => {
  // Captura de elementos del DOM
  const saveButton = document.getElementById('save-parcelacion');
  const cancelButton = document.getElementById('cancel-parcelacion');
  const parcelacionForm = document.getElementById('parcelacion-form');

  // Aplica el dropdown diseñado a los selects del modal y los refresca tras un reset
  const refrescarSelectsModal = () => {
    ['SelectComunaModal', 'SelectFase', 'SelectCultivo', 'Selectregistro'].forEach((id) => {
      const s = document.getElementById(id);
      if (s && window.enhanceSelect) window.enhanceSelect(s);
    });
  };
  refrescarSelectsModal();

  // Evento para guardar la parcelación
  saveButton.addEventListener('click', async () => {
    const latitud = document.getElementById('latitud').value;
    const longitud = document.getElementById('longitud').value;
    const id_sector = document.getElementById('SelectComunaModal').value; // Sector
    const id_fase = document.getElementById('SelectFase').value; // Fase
    const id_cultivo = document.getElementById('SelectCultivo').value; // Cultivo
    const registrada = document.getElementById('Selectregistro').value; // Obtener valor dinámico

    // Validar que todos los campos estén completos
    if (!latitud || !longitud || !id_sector || !id_fase || !id_cultivo || registrada === '') {
      window.notify('Por favor, completa todos los campos antes de guardar.');
      return;
    }

    // Enviar datos al servidor
    try {
      const response = await fetch('/parcelas/api/SaveParcel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitud, longitud, id_sector, id_fase, id_cultivo, registrada }),
      });

      const result = await response.json();

      if (result.success) {
        window.notify('Parcelación guardada exitosamente.');
        parcelacionForm.reset(); // Limpia el formulario después de guardar
        refrescarSelectsModal();
      } else {
        window.notify('Error al guardar la parcelación: ' + result.message);
      }
    } catch (error) {
      console.error('Error al guardar la parcelación:', error);
      window.notify('Ocurrió un error al guardar la parcelación. Intenta nuevamente.');
    }
  });

  // Evento para cancelar la parcelación
  cancelButton.addEventListener('click', () => {
    parcelacionForm.reset(); // Limpia el formulario
    refrescarSelectsModal();

    // Eliminar el marcador actual del mapa si existe
    if (currentMarker) {
      currentMarker.remove();
      currentMarker = null; // Limpiar la referencia
    }

    // Mostrar mensaje de cancelación
    window.notify('Parcelación cancelada.');

    // Desactivar el modo de creación de parcela
    isCreatingParcela = false;
  });
});