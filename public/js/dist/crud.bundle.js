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
/* ===== script.js ===== */
function getTableNameFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const table = urlParams.get('table');
    return table ? table : 'parcelacion'; // Devuelve null si no hay parámetro 'table'
}

document.addEventListener("DOMContentLoaded", () => {
    const tableName = getTableNameFromUrl();
    if (tableName) {
        loadItems(tableName); // Solo carga la tabla si hay un parámetro 'table'
    }
});

// Inicializar `nameTable` de forma dinámica basado en la URL
let nameTable = getTableNameFromUrl(); // Valor dinámico basado en la URL

/********************************** READ ********************************/
/****** LEE TODOS LOS ITEMS, CREA LA TABLA Y RELLENA CON LOS ITEMS ******/
// Cargar ítems según la tabla seleccionada
// Mapeo de tabla del CRUD -> apartado y capacidad de eliminar
const CRUD_PERM = {
    parcelacion: { apartado: 'parcelaciones',  del: 'parcelacion.eliminar' },
    cuarentena:  { apartado: 'cuarentenas',    del: 'cuarentena.eliminar', crearCap: 'cuarentena.activar_desactivar' },
    sector:      { apartado: 'datos_maestros', del: 'maestro.eliminar' },
    cultivo:     { apartado: 'datos_maestros', del: 'maestro.eliminar' },
    fase:        { apartado: 'datos_maestros', del: 'maestro.eliminar' },
    region:      { apartado: 'datos_maestros', del: 'maestro.eliminar' },
    provincia:   { apartado: 'datos_maestros', del: 'maestro.eliminar' },
    usuario:     { apartado: 'usuarios',       del: 'usuario.eliminar' }
};
function puedeCrearTabla(t) {
    const c = CRUD_PERM[t]; if (!c || !window.Perm) return false;
    return c.crearCap ? window.Perm.tieneCapacidad(c.crearCap) : window.Perm.puedeAccionar(c.apartado);
}
function puedeEditarTabla(t) {
    const c = CRUD_PERM[t]; if (!c || !window.Perm) return false;
    return window.Perm.puedeAccionar(c.apartado);
}
function puedeEliminarTabla(t) {
    const c = CRUD_PERM[t]; if (!c || !window.Perm) return false;
    return window.Perm.tieneCapacidad(c.del);
}

async function loadItems(Table, sectors = [], phases = [], crops = [], registered = [], regiones = [], provincias = [], radio = [], roles = []) {
    // Guardar los filtros aplicados para volver a marcarlos al reconstruir los selects
    window.appliedFilters = {
        filter_sector: sectors || [],
        filter_fase: phases || [],
        filter_cultivo: crops || [],
        filter_registrada: registered || [],
        filter_region: regiones || [],
        filter_provincia: provincias || [],
        filter_radio: radio || [],
        filter_rol: roles || []
    };
    const crudTitle = document.getElementById('crud-title'); // Obtiene el elemento del título
    const addButton = document.getElementById('addButton'); // Obtiene el botón de agregar
    const filters = document.getElementById('filters');
    nameTable = Table; // Guarda el nombre de la tabla seleccionada
    console.log(nameTable); // Imprime el nombre de la tabla en la consola
    addButton.style.setProperty('display', puedeCrearTabla(Table) ? 'inline-flex' : 'none', 'important'); // Mostrar 'Agregar' solo si puede crear


    let url = `api/${nameTable}`; // URL base
    
    // Cambiar el título y el botón según la tabla.
    // Solo se reconstruyen los filtros cuando CAMBIA la tabla; al aplicar un
    // filtro sobre la misma tabla se omite esto y solo se recarga la tabla.
    if (nameTable !== window.__crudTable) {
    if (nameTable === 'parcelacion') {
        crudTitle.textContent = 'Gestión de Parcelaciones';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Parcelacion';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        addButton.onclick = () => openModal('parcelacion');
        loadOptionsFilter(nameTable);
        filters.innerHTML = `
<div id="filters" class="flex flex-nowrap gap-4 justify-center items-center overflow-x-auto py-4">
    <div class="flex-shrink-0 w-60">
        <select name="filter_sector" id="filter_sector" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500" multiple>
            <option value="">Seleccione la zona de interés</option>
        </select>
    </div>
    <div class="flex-shrink-0 w-60">
        <select name="filter_fase" id="filter_fase" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500" multiple>
            <option value="">Seleccione una fase</option>
        </select>
    </div>
    <div class="flex-shrink-0 w-60">
        <select name="filter_cultivo" id="filter_cultivo" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500" multiple>
            <option value="">Selecciona el tipo de cultivo</option>
        </select>
    </div>
    <div class="flex-shrink-0 w-60">
        <select name="filter_registrada" id="filter_registrada" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500">
            <option value="">Seleccione si está registrada</option>
            <option value="No Registrada">No Registrada</option>
            <option value="Registrada">Registrada</option>
        </select>
    </div>
</div>
        `;
        ///fin test kosmi
        addButton.onclick = () => openModal('parcelacion'); // Asigna función al botón
    } else if (nameTable === 'region') {
        crudTitle.textContent = 'Gestión de Regiones';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Región';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        filters.innerHTML = ``;
        addButton.onclick = () => openModal('region');
    } else if (nameTable === 'provincia') {
        crudTitle.textContent = 'Gestión de Provincia';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar provincia';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        addButton.onclick = () => openModal('provincia');
        loadOptionsRegionFilter();
        filters.innerHTML = `    
            <div id="filters" class="flex flex-nowrap gap-4 justify-center items-center overflow-x-auto py-4">
            <div class="flex flex-col w-60">
                <select name="filter_sector" id="filter_region" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500">
                    <option value="">Seleccione la zona de interés</option>
                </select>
            </div>
            </div>
            `;

    } else if (nameTable === 'sector') {
        crudTitle.textContent = 'Gestión de Sector';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Sector';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        addButton.onclick = () => openModal('sector');
        loadOptionsSectorFilter();
        filters.innerHTML = `
    
        <div id="filters" class="flex flex-wrap gap-10 justify-center items-center">
            <div class="flex flex-col w-60">
                <select name="filter_sector" id="filter_provincia" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500" multiple>
                    <option value="">Seleccione la zona de interés</option>
                </select>
            </div>
        </div>
        
        `;
        addButton.onclick = () => openModal('sector');

        

    } else if (nameTable === 'cuarentena') {
        crudTitle.textContent = 'Gestión de Cuarentena';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Cuarentena';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        addButton.onclick = () => openModal('cuarentena');
        loadOptionsFilter(nameTable);
        filters.innerHTML = `

        <div id="filters" class="flex flex-wrap gap-10 justify-center items-center">
            <div class="flex flex-col w-60">
                <select name="filter_sector" id="filter_sector" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500" multiple>
                    <option value="">Seleccione la zona de interés</option>
                </select>
            </div>    
            <div class="flex flex-col w-70">
                <select name="filter_sector" id="filter_radio" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500">
                    <option value="">Todas las opciones</option>
                    <option value="Valores">Radio</option>
                    <option value="Trazado">Trazado</option>
                </select>
            </div>
        </div>
        
        `;

        
    } else if (nameTable === 'cultivo') {
        crudTitle.textContent = 'Gestión de Cultivo';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Cultivo';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        filters.innerHTML = ``;
        addButton.onclick = () => openModal('cultivo');
    } else if (nameTable === 'fase') {
        crudTitle.textContent = 'Gestión de Fase';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Fase';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        filters.innerHTML = ``;
        addButton.onclick = () => openModal('fase');
    } else if (nameTable === 'usuario') {
        crudTitle.textContent = 'Gestión de Usuario';
        crudTitle.className = 'text-5xl font-bold';
        addButton.textContent = 'Agregar Usuario';
        addButton.className = 'text-black font-semibold hover:text-black py-2 px-4 border border-blue-500 hover:border-black rounded';
        addButton.onclick = () => openModal('usuario');

        filters.innerHTML = `
                <div id="filters" class="flex flex-wrap gap-10 justify-center items-center">
                <div class="flex flex-col w-70">
                <select name="filter_sector" id="filter_rol" class="block w-full appearance-none border border-gray-300 text-gray-700 py-2 px-3 rounded leading-tight focus:outline-none focus:border-blue-500">
                    <option value="">Todos los roles</option>
                    <option value="administrador">Administrador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="inspector">Inspector</option>
                    <option value="analista">Analista</option>
                    <option value="lectura">Lectura</option>
                </select>
            </div>
        </div>
        `;
        
    } else if (nameTable === 'historial') {
        crudTitle.textContent = 'Gestión de Historial';
        crudTitle.className = 'text-5xl font-bold';
        filters.innerHTML = ``;
        addButton.style.setProperty('display', 'none', 'important'); // Oculta el botón de agregar para historial
        //addButton.textContent = 'Agregar Historial';
        //addButton.onclick = () => openModal('historial');
    }
    window.__crudTable = nameTable; // recordar la tabla cuyos filtros ya están armados
    } // fin: reconstruir filtros solo al cambiar de tabla

    // Si hay filtros, construir la URL con parámetros
    if (sectors.length || phases.length || crops.length || registered.length || regiones.length || provincias.length || radio.length || roles.length) {
        const params = new URLSearchParams();
        if (sectors.length) params.append('sectors', sectors.join(','));
        if (phases.length) params.append('phases', phases.join(','));
        if (crops.length) params.append('crops', crops.join(','));
        if (regiones.length) params.append('regiones', regiones.join(','));
        if (provincias.length) params.append('provincias', provincias.join(';'));
        if (radio.length) params.append('radio', radio.join(','));
        if (roles.length) params.append('roles', roles.join(','));
        if (registered.length) params.append('registered', registered.join(','));
        console.log(params);
        url = `api/${nameTable}/filter?${params.toString()}`; // Usar la nueva ruta
        console.log('URL con parámetros de filtrado:', url); // Loguear la URL
    }
    
    const crudStatus = document.getElementById('crud-status');
    const itemListPrev = document.getElementById('itemList');
    const crudEmptyPrev = document.getElementById('crud-empty');
    if (itemListPrev) itemListPrev.innerHTML = '';
    if (crudEmptyPrev) crudEmptyPrev.style.display = 'none';
    if (window.UIState) UIState.loading(crudStatus, 'Cargando…');

    try {
        const response = await fetch(url); // Realiza la solicitud para cargar ítems
        if (!response.ok) {
            throw new Error('Error al cargar los datos');
        }
        const items = await response.json(); // Convierte la respuesta a JSON
        if (window.UIState) UIState.hide(crudStatus);

        const itemList = document.getElementById('itemList'); // Obtiene la lista de ítems
        const tableHeaders = document.getElementById('tableHeaders'); // Obtiene los encabezados de la tabla

        // Limpiar contenido previo
        itemList.innerHTML = '';
        tableHeaders.innerHTML = '';

        const emptyEl = document.getElementById('crud-empty');
        if (emptyEl) emptyEl.style.display = (items && items.length > 0) ? 'none' : 'flex';

        if (items.length > 0) {
            // Definir encabezados según los datos
            const headers = Object.keys(items[0]); // Obtener claves del primer objeto
            headers.forEach((header, index) => {
                /*
                // Si estamos trabajando con la tabla de usuarios, omitimos la columna 'password'
            if (nameTable === 'usuario' && header === 'password') {
                return; // Salir de la iteración sin agregar esta columna
            }    */
                const th = document.createElement('th'); // Crear un nuevo encabezado
                th.textContent = header.charAt(0).toUpperCase() + header.slice(1); // Capitalizar
                tableHeaders.appendChild(th); // Agregar encabezado a la tabla
                if (nameTable === 'parcelacion') {
                // Si estamos en la tercera columna, añadimos el encabezado de "Imagen" después
                if (index === 2) {
                    const thImagen = document.createElement('th');
                    thImagen.textContent = 'Imagen';
                    tableHeaders.appendChild(thImagen);
                }}
            });
            
            if (nameTable !== 'historial') {
            // Agregar el encabezado de "Acciones" al final
            const thAcciones = document.createElement('th');
            thAcciones.textContent = 'Acciones';
            tableHeaders.appendChild(thAcciones);
            }
            // Poblamos las filas
            items.forEach(item => {
                const row = document.createElement('tr'); // Crear una nueva fila
                
                // Crear celdas para cada encabezado
                headers.forEach((header, index) => {
                    // Evitar incluir la columna 'password' en la tabla de 'usuarios'
                    if (nameTable === 'usuarios' && header === 'password') {
                        return; // Salir de la iteración sin crear una celda para 'password'
                    }

                    const td = document.createElement('td'); // Crear una nueva celda
                    td.dataset.label = header.charAt(0).toUpperCase() + header.slice(1); // Etiqueta para vista de tarjetas

                    // Si la columna es 'password', reemplazar su valor por '************'
                    if (header === 'password') {
                        td.textContent = '************'; // Reemplazar con asteriscos
                    } else {
                        td.textContent = item[header]; // Asignar valor del item
                    }
                    row.appendChild(td); // Agregar celda a la fila

                    // Si estamos en la tabla 'parcelacion', añadimos una celda especial
                    if (nameTable === 'parcelacion') {
                    // Si estamos en la tercera columna, añadimos la celda de imagen después
                        if (index === 2) {
                            const imagenTd = document.createElement('td');
                            imagenTd.dataset.label = 'Imagen';
                            const verImagenBtn = document.createElement('button'); // Crear botón para ver imagen
                            verImagenBtn.innerHTML = '<i class="fas fa-image"></i> Ver Imagen'; // Texto del botón
                        verImagenBtn.className='crud-action crud-action--img'; // Clase del boton 
                            verImagenBtn.onclick = () => viewImage(item.id); // Llamar a la función viewImage
                            imagenTd.appendChild(verImagenBtn); // Agregar botón a la celda
                            row.appendChild(imagenTd); // Agregar celda de imagen a la fila
                        }
                }});
                if (nameTable !== 'historial') {
                    const actionsTd = document.createElement('td'); // Crear celda de acciones
                    actionsTd.dataset.label = 'Acciones';
                    actionsTd.innerHTML = `
                        ${puedeEditarTabla(nameTable) ? `<button class="crud-action crud-action--edit" onclick="editItem(${item.id})"><i class="fas fa-pen"></i> Editar</button>` : ''}
                        ${puedeEliminarTabla(nameTable) ? `<button class="crud-action crud-action--delete" onclick="deleteItem(${item.id})"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
                    `;
                    row.appendChild(actionsTd); // Agregar celda de acciones a la fila
                }
                itemList.appendChild(row); // Agregar fila a la lista de ítems
            });
        }
        if (typeof applyCrudCards === 'function') applyCrudCards();
    } catch (error) {
        console.error('Error al cargar los ítems:', error); // Manejo de errores
        const il = document.getElementById('itemList'); if (il) il.innerHTML = '';
        const ce = document.getElementById('crud-empty'); if (ce) ce.style.display = 'none';
        if (window.UIState) {
            UIState.error(crudStatus, 'No se pudieron cargar los datos.', function () {
                loadItems(Table, sectors, phases, crops, registered, regiones, provincias, radio, roles);
            });
        }
    }
}

// Convierte la tabla en tarjetas SOLO cuando no entra (requiere scroll horizontal) en móvil.
function applyCrudCards() {
    const wrap = document.querySelector('.crud-table-wrap');
    const table = document.getElementById('itemsTable');
    if (!wrap || !table) return;
    wrap.classList.remove('crud-cards'); // medir el ancho como tabla normal
    const narrow = window.matchMedia('(max-width: 768px)').matches;
    const overflowing = table.scrollWidth > wrap.clientWidth + 1;
    if (narrow && overflowing) wrap.classList.add('crud-cards');
}
if (!window.__crudCardsResize) {
    window.__crudCardsResize = true;
    let _crudCardsT;
    window.addEventListener('resize', function () {
        clearTimeout(_crudCardsT);
        _crudCardsT = setTimeout(applyCrudCards, 150);
    });
}



/************ MODAL PARA VISUALIZAR IMAGEN ***********/
// Función para manejar la visualización de la imagen en un modal
function viewImage(itemId) {
    const imageUrl = `api/parcelacion/get-image?id=${itemId}`; // Construye la URL para obtener la imagen
    const modalImage = document.getElementById('modalImage');
    if (modalImage) { // Verifica que el elemento existe
        modalImage.src = imageUrl; // Asigna la URL de la imagen al modal
        document.getElementById('imageModal').style.display = 'flex'; // Muestra el modal
        document.getElementById('imageModal').style.backgroundColor = 'rgb(0, 0, 0, 0.5)'; // Muestra el modal
    } else {
        console.error('El elemento modalImage no se encuentra en el DOM.');
    }
}

// Función para cerrar el modal que muestra la imagen
function closeModalImg() {
    const modal = document.getElementById('imageModal'); // Obtiene el elemento del modal de imagen
    if (modal) { // Verifica que el modal exista
        modal.style.display = 'none'; // Oculta el modal
    }
}
/*****************************************************/



/**************** MODAL PARA FORMULARIO DE CREAR Y EDITAR *********************/
// Función para abrir el modal y cargar los campos correspondientes según la tabla seleccionada
async function openModal(nameTable, item = null) {
    const modal = document.getElementById('myModal'); // Obtiene el elemento del modal
    const title = document.getElementById('modalTitle'); // Obtiene el título del modal
    const formFields = document.getElementById('formFields'); // Obtiene el contenedor de los campos del formulario
    const crudTitle = document.getElementById('crud-title'); // Obtiene el título de CRUD

    // Limpiar campos previos
    formFields.innerHTML = '';

    // Configuración de campos y título según la tabla seleccionada
    if (nameTable === 'parcelacion') {
        title.textContent = item ? 'Editar Parcelación' : 'Agregar Parcelación';
        
    
        // Campos para Parcelación
        formFields.innerHTML = `
<div class="flex flex-col sm:flex-row sm:flex-wrap gap-4">
    <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
    <input type="number" id="latitud" placeholder="Latitud" step="any" min="-90" max="90" required class="flex-1 min-w-[150px]">
    <input type="number" id="longitud" placeholder="Longitud" step="any" min="-180" max="180" required class="flex-1 min-w-[150px]">
    <input type="file" name="image" accept="image/*" id="image" class="flex-1 min-w-[150px]">
    <select name="id_sector" id="id_sector" required class="flex-1 min-w-[150px]">
        <option value="">Seleccione un Sector</option>
        <!-- Opciones dinámicas -->
    </select>
    <select name="id_fase" id="id_fase" required class="flex-1 min-w-[150px]">
        <option value="">Seleccione una Fase</option>
        <!-- Opciones dinámicas -->
    </select>
    <select name="id_cultivo" id="id_cultivo" required class="flex-1 min-w-[150px]">
        <option value="">Seleccione un Cultivo</option>
        <!-- Opciones dinámicas -->
    </select>
    <select name="registrada" id="registrada" required class="flex-1 min-w-[150px]">
        <option value="">Seleccione si está registrada</option>
        <option value="0">No Registrada</option>
        <option value="1">Registrada</option>
    </select>
</div>

        `;
        // Solo cargar opciones si es 'parcelacion'
        try {
            await loadOptions(nameTable);
        } catch (error) {
            console.error('Error al cargar opciones en el modal:', error);
        }

    } else if (nameTable === 'region') {
        title.textContent = item ? 'Editar Región' : 'Agregar Región';
        
        // Campos para Región
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <input type="text" id="numero" placeholder="Número" name="numero" required>
            <input type="text" id="nombre" placeholder="Nombre" name="nombre" required>
        `;
    } else if (nameTable === 'provincia') {
        title.textContent = item ? 'Editar Provincia' : 'Agregar Provincia';

        // Campos para Provincia
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <select name="id_region" id="id_region" required>
                <option value="">Seleccione una Region</option>
                <!-- Opciones dinámicas -->
            </select>
            <input type="text" id="nombre" placeholder="Nombre" name="nombre" required>
        `;

        try {
            await loadOptionsRegion();
        } catch (error) {
            console.error('Error al cargar opciones en el modal:', error);
        }
    } else if (nameTable === 'sector') {
        title.textContent = item ? 'Editar Sector' : 'Agregar Sector';

        // Campos para Sector
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <select name="id_provincia" id="id_provincia" required>
                <option value="">Seleccione una Provincia</option>
                <!-- Opciones dinámicas -->
            </select>
            <input type="text" id="comuna" placeholder="Comuna" name="comuna" required>
        `;

        try {
            await loadOptionsSector();
        } catch (error) {
            console.error('Error al cargar opciones en el modal:', error);
        }
    } else if (nameTable === 'cuarentena') {
        title.textContent = item ? 'Editar Cuarentena' : 'Agregar Cuarentena';

        // Campos para Cuarentena
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <select name="id_sector" id="id_sector" required>
                <option value="">Seleccione una Sector</option>
                <!-- Opciones dinámicas -->
            </select>
            <input type="number" id="latitud" placeholder="Latitud" step="any" min="-90" max="90" required>
            <input type="number" id="longitud" placeholder="Longitud" step="any" min="-180" max="180" required>
            <input type="number" id="radio" placeholder="Radio (Opcional)" name="radio" step="any">
            <input type="text" id="comentario" placeholder="Motivo" name="comentario" required>
            <select name="activa" id="activa" required>
                <option value="">Seleccione si está activa</option>
                <option value="1">True</option>
                <option value="0">False</option>
            </select>
        `;

        try {
            await loadOptions(nameTable);
        } catch (error) {
            console.error('Error al cargar opciones en el modal:', error);
        }
    } else if (nameTable === 'cultivo') {
        title.textContent = item ? 'Editar Cultivo' : 'Agregar Cultivo';
        
        // Campos para Región
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <input type="text" id="nombre" placeholder="Nombre Cultivo" name="nombre" required>
        `;
    } else if (nameTable === 'fase') {
        title.textContent = item ? 'Editar Fase' : 'Agregar Fase';
        
        // Campos para Fase
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <input type="text" id="nombre" placeholder="Nombre Fase" name="nombre" required>
        `;
    } else if (nameTable === 'usuario') {
        title.textContent = item ? 'Editar Usuario' : 'Agregar Usuario';
        // Campos para Usuario
        let passwordField = '';
        if (!item) {  // Solo mostrar el campo de contraseña si es creación (item es null)
            passwordField = `<input type="password" id="password" placeholder="Password" name="password" required>`;
        }
        // Campos para Usuario
        formFields.innerHTML = `
            <input type="hidden" id="itemId"> <!-- Campo oculto para el ID -->
            <input type="text" id="nombre" placeholder="Nombre" name="nombre" required>
            <input type="text" id="apellido" placeholder="Apellido" name="apellido" required>
            <input type="email" id="correo" placeholder="Correo Electrónico" name="correo" required>
            <input type="number" id="rut" placeholder="RUT" name="rut" required>
            <input type="text" id="dv_rut" placeholder="Dígito Verificador" name="dv_rut" required pattern="^[0-9Kk]$" title="Ingrese un dígito o 'K'">
            <select name="rol" id="rol" required>
                <option value="">Seleccione rol</option>
            </select>
            <input type="text" id="usuario" placeholder="Nombre de usuario" name="usuario" required>
            ${passwordField}  <!-- Solo se incluirá el campo de password si es creación -->
        `;
        poblarRolesSelect('rol', item ? item.rol : '');
    }
    
    // Si hay un item, llenar el formulario con los datos
    if (item) {
        console.log('openModal:', item); // Verificación del ID.
        // Verifica si la tabla es parcelacion y si el item tiene la propiedad id_parcelacion
        if (nameTable === 'parcelacion') {
            document.getElementById('itemId').value = item.id_parcelacion; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            document.getElementById('latitud').value = item.latitud; // Llenar campo de latitud
            document.getElementById('longitud').value = item.longitud; // Llenar campo de longitud
            

            // Asigna valores a los select después de un retardo para asegurarse de que las opciones se hayan cargado
            
                document.getElementById('id_sector').value = item.id_sector || '';
                document.getElementById('id_fase').value = item.id_fase || '';
                document.getElementById('id_cultivo').value = item.id_cultivo || '';
            

            const registradaSelect = document.getElementById('registrada');
            registradaSelect.value = item.registrada ? '1' : '0';  // Asignar valor a "registrada"
        } else if (nameTable === 'region') {
            document.getElementById('itemId').value = item.id_region; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            document.getElementById('nombre').value = item.nombre;
            document.getElementById('numero').value = item.numero;

        } else if (nameTable === 'provincia') {
            document.getElementById('itemId').value = item.id_provincia; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            // Asigna valores después de un retardo para asegurar que las opciones se hayan cargado
            
            document.getElementById('id_region').value = item.id_region;
            
            document.getElementById('nombre').value = item.nombre;

        } else if (nameTable === 'sector') {
            document.getElementById('itemId').value = item.id_sector; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            // Asigna valores después de un retardo para asegurar que las opciones se hayan cargado
            
            document.getElementById('id_provincia').value = item.id_provincia;
             
            document.getElementById('comuna').value = item.comuna;

        } else if (nameTable === 'cuarentena') {
            document.getElementById('itemId').value = item.id_cuarentena; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID
            
            document.getElementById('id_sector').value = item.id_sector;
             // Retardo para asegurarse de que las opciones se hayan cargado
            document.getElementById('latitud').value = item.latitud; // Llenar latitud
            document.getElementById('longitud').value = item.longitud; // Llenar longitud
            document.getElementById('radio').value = item.radio; // Llenar radio
            document.getElementById('comentario').value = item.comentario; // Llenar comentario
            const activaSelect = document.getElementById('activa');
            activaSelect.value = item.activa ? '1' : '0';  // Asignar valor a "activa"

        } else if (nameTable === 'cultivo') {
            document.getElementById('itemId').value = item.id_cultivo; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            document.getElementById('nombre').value = item.nombre;

        } else if (nameTable === 'fase') {
            document.getElementById('itemId').value = item.id_fase; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            document.getElementById('nombre').value = item.nombre;

        } else if (nameTable === 'usuario') {
            document.getElementById('itemId').value = item.id_usuario; // Ajustar según el ID
            console.log('ID del ítem:', document.getElementById('itemId').value); // Verificación del ID

            document.getElementById('correo').value = item.correo;
            //document.getElementById('password').value = item.password;
            document.getElementById('usuario').value = item.usuario;
            document.getElementById('rut').value = item.rut;
            document.getElementById('dv_rut').value = item.dv_rut;
            document.getElementById('nombre').value = item.nombre;
            document.getElementById('apellido').value = item.apellido;
            document.getElementById('rol').value = item.rol;


        }
    }

    modal.style.display = 'flex'; // Mostrar modal
    modal.style.backgroundColor = 'rgb(0, 0, 0, 0.5)';
}

// Función para cerrar el modal y reiniciar el formulario
function closeModal() {
    const modal = document.getElementById('myModal'); // Obtiene el elemento del modal
    modal.style.display = "none"; // Oculta el modal

    // Reiniciar el formulario
    document.getElementById('itemForm').reset(); // Restablece todos los campos del formulario
    document.getElementById('itemId').value = ''; // Asegúrate de resetear el ID también
}
/*****************************************************************************/

/*********** LEER ITEM PARA CARGAR SUS DATOS **********************/
// Función para editar un ítem dado su ID
function editItem(id) {
    console.log(nameTable); // Muestra en consola el nombre de la tabla actual
    console.log(id); // Muestra en consola el ID del ítem que se va a editar

    // Realiza una petición para obtener el ítem por su ID
    fetch(`/api/${nameTable}/${id}`)
        .then(response => {
            // Verifica si la respuesta es correcta
            if (!response.ok) throw new Error('Error al obtener el ítem');
            return response.json(); // Devuelve los datos en formato JSON

        })
        .then(item => {
            console.log(item, 'item'); // Ver los datos obtenidos
            
            // Abre el modal con los datos del ítem
            document.getElementById('modalTitle').innerText = `Editar ${nameTable}`; // Cambia el título del modal
            document.getElementById('submitButton').innerText = 'Confirmar Cambios'; // Cambia el texto del botón
            openModal(nameTable, item); // Llama a la función openModal pasando el objeto item
        })
        .catch(error => console.error('Error:', error)); // Maneja errores y los muestra en consola
}


/******* CREATE OR UPDATE ************/
// Agregar un listener para el evento submit del formulario
document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que el formulario se envíe de manera convencional
    trimInputFields(); // Limpia los campos del formulario

    // Validación específica para el usuario
    if (nameTable === 'usuario') {
        // Obtener los valores de RUT y dígito verificador
        const rutInput = document.getElementById('rut').value;
        const dvInput = document.getElementById('dv_rut').value;

        // Validar longitud mínima del RUT
        if (rutInput.replace(/\./g, '').length < 7) {
            window.notify('El RUT debe tener al menos 7 dígitos.');
            return; // Salir de la función si la longitud no es válida
        }
        // Validar el RUT
        if (!validarRUT(rutInput, dvInput)) {
            window.notify('El dígito verificador del RUT es incorrecto.'); // Alerta si el dv no es inválido
            return; // Salir de la función si la validación falla
        }
    }
    const id = document.getElementById('itemId').value; // Obtener el ID del ítem
    console.log('ID:', id);
    const formData = new FormData(); // Crear un nuevo objeto FormData

    // Agregar campos comunes dependiendo de la tabla
    if (nameTable === 'parcelacion') {
        formData.append('latitud', document.getElementById('latitud').value);
        formData.append('longitud', document.getElementById('longitud').value);
        formData.append('id_sector', document.getElementById('id_sector').value);
        formData.append('id_fase', document.getElementById('id_fase').value);
        formData.append('id_cultivo', document.getElementById('id_cultivo').value);
        formData.append('registrada', document.getElementById('registrada').value);
        const imageFile = document.getElementById('image').files[0];
        if (imageFile) {
            formData.append('image', imageFile); // Agregar archivo de imagen si existe
        }
    } else if (nameTable === 'region') {
        formData.append('numero', document.getElementById('numero').value);
        formData.append('nombre', document.getElementById('nombre').value);
    } else if (nameTable === 'provincia') {
        formData.append('id_region', document.getElementById('id_region').value);
        formData.append('nombre', document.getElementById('nombre').value);
    } else if (nameTable === 'sector') {
        formData.append('id_provincia', document.getElementById('id_provincia').value);
        formData.append('comuna', document.getElementById('comuna').value);
    } else if (nameTable === 'cuarentena') {
        formData.append('latitud', document.getElementById('latitud').value);
        formData.append('longitud', document.getElementById('longitud').value);
        formData.append('id_sector', document.getElementById('id_sector').value);
        const radio = document.getElementById('radio').value;
        const radioValue = radio === '' ? null : Number(radio);
        formData.append('radio', radioValue);
        formData.append('comentario', document.getElementById('comentario').value);
        formData.append('activa', document.getElementById('activa').value);
    } else if (nameTable === 'cultivo') {
        formData.append('nombre', document.getElementById('nombre').value);
    } else if (nameTable === 'fase') {
        formData.append('nombre', document.getElementById('nombre').value);
    } else if (nameTable === 'usuario') {
        formData.append('correo', document.getElementById('correo').value);
        formData.append('usuario', document.getElementById('usuario').value);
        if (document.getElementById('password')) {
            formData.append('password', document.getElementById('password').value);
        }
        formData.append('rut', document.getElementById('rut').value);
        formData.append('dv_rut', document.getElementById('dv_rut').value);
        formData.append('nombre', document.getElementById('nombre').value);
        formData.append('apellido', document.getElementById('apellido').value);
        formData.append('rol', document.getElementById('rol').value);
    }


    for (const [key, value] of formData.entries()) {
        console.log(`Key: ${key}, Value: ${value}`);
    }
    console.log('Campos: ' + formData);

    // Validar los campos antes de enviar
    if (!validarCampos(formData)) {
        console.log('salir si hay campos vacios');
        return; // Salir si hay un campo vacío
    }

    try {
        let response;
        if (id) {
            console.log('zzz:', id);
            for (const [key, value] of formData.entries()) {
                console.log(`Key: ${key}, Value: ${value}`);
            }
            // Actualizar ítem existente
            response = await fetch(`/api/${nameTable}/${id}`, {
                method: 'PUT',
                body: formData // Envía el FormData directamente
            }
            
        )
        loadItems(nameTable);
        ;

            if (!response.ok) {
                throw new Error('Error al actualizar el ítem');
            }
        } else {
            // Crear nuevo ítem
            console.log(nameTable);
            for (const [key, value] of formData.entries()) {
                console.log(`DATOS Key: ${key}, Value: ${value}`);
            }
            response = await fetch(`/api/${nameTable}/`, {
                method: 'POST',
                body: formData // Envía el FormData directamente
            });

            if (!response.ok) {
                const errorData = await response.json(); // Obtener los datos de error del servidor
                if (errorData.error) {
                    window.notify(errorData.error); // Mostrar alerta con el mensaje de error
                    return; // Salir de la función si hay un error en la respuesta
                } else {
                    throw new Error('Error al crear el ítem');
                }
            }
        }

        // Reiniciar el formulario y recargar los ítems
        document.getElementById('itemForm').reset();
        closeModal(); // Cerrar el modal
        await loadItems(nameTable); // Recargar ítems

    } catch (error) {
        console.error('Error:', error);
    }
});

/******* DELETE ************/
// Función asíncrona para eliminar un ítem dado su ID
async function deleteItem(id) {

    // Alerta de confirmación al usuario antes de proceder con la eliminación
    const confirmation = await window.confirmar('¿Estás seguro de que deseas eliminar este ítem?');

    if (confirmation) { // Si el usuario confirma
        try {
            // Realiza una solicitud DELETE al servidor para eliminar el ítem
            const response = await fetch(`/api/${nameTable}/${id}`, {
                method: 'DELETE', // Especifica que la solicitud es de tipo DELETE
            });

            // Verifica si la respuesta fue exitosa
            if (response.ok) {
                window.notify('Ítem eliminado con éxito.'); // Muestra un mensaje de éxito
                loadItems(nameTable); // Recargar la lista de ítems después de eliminar
            } else {
                throw new Error('Error al eliminar el ítem'); // Lanza un error si la respuesta no es exitosa
            }
        } catch (error) {
            // Captura cualquier error que ocurra durante el proceso
            console.error('Error al eliminar el ítem:', error);
            window.notify('No se pudo eliminar el ítem.');
        }
    }
}

/******* FUNCION PARA NO PERMITIR ESPACIOS EN BLANCO ES FORMULARIOS *******/
// Función para validar los campos de un formulario
function validarCampos(formData) {
    for (const [key, value] of formData.entries()) {
        console.log(key, value);

        // Verifica si el valor es una cadena antes de aplicar trim
        if (typeof value === 'string' && value.trim() === '') {
            window.notify(`Los campos no pueden estar vacíos.`); // Muestra una alerta si el campo está vacío
            return false; // Retorna false si hay un campo vacío
        }
        
        // Si el valor es un objeto File, no hacemos nada porque no es obligatorio
        if (value instanceof File) {
            continue; // Ignora el campo de imagen, ya que no es obligatorio
        }
    }
    return true; // Retorna true si todos los campos son válidos
}

// Limpia los espacios en blanco de los formulatios
function trimInputFields() {
    // Selecciona todos los campos de texto, email y contraseña dentro del formulario
    const fieldsToTrim = Array.from(document.querySelectorAll('#itemForm input[type="text"], #itemForm input[type="email"], #itemForm input[type="password"]'));
    console.log(fieldsToTrim);

    // Elimina espacios al inicio y al final de cada campo
    return fieldsToTrim.map(field => {
        field.value = field.value.trim(); // Elimina espacios al inicio y al final
        return field; // Retorna el campo para la validación
    });
}
/**************************************************************************/



/********************** VALIDA DEL DIGITO VERIFICADOR *************************/
function validarRUT(rut, dvIngresado) {
    // Eliminar puntos y convertir a número
    const rutNumerico = parseInt(rut.replace(/\./g, ''), 10); // Asegúrate de que el RUT sea un número

    // Calcular el dígito verificador
    let suma = 0;
    let multiplicador = 2;

    for (let i = rutNumerico; i > 0; i = Math.floor(i / 10)) {
        suma += (i % 10) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1; // Alternar entre 2 y 7
    }

    const dvCalculado = 11 - (suma % 11);
    const dvFinal = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();

    // Comparar el dígito verificador calculado con el ingresado, ignorando mayúsculas
    return dvFinal.toUpperCase() === dvIngresado.toUpperCase();
}

/******************************************************************************/


/************************** CERRAR SESION *****************************/
// Función para cerrar sesion.
async function logout() {
    try {
        const response = await fetch('/api/auth/logout');

        if (!response.ok) {
            throw new Error('Error al cerrar sesión');
        }

        // Si la sesión se cerró correctamente, redirige a la página de login
        window.location.href = '/login';
    } catch (error) {
        console.error('Error:', error);
        window.notify('No se pudo cerrar la sesión. Intenta nuevamente.');
    }
}
/******************************************************************************/


/************************** OPCIONES PARA LOS SELECTS *****************************/
// Función para cargar opciones de dropdowns dependiendo de la tabla (Cuarentena y parcelacion)
async function loadOptions(nameTable) {
    try {

        // Realiza una solicitud para obtener las opciones
        const response = await fetch(`/api/parcelacion/opciones`)

        // Verifica si la respuesta fue exitosa
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`); // Manejo de errores HTTP
        }

        const data = await response.json(); // Parsea la respuesta JSON

        // Verifica que la estructura de datos sea la esperada
        if (!data.sectores || !data.fases || !data.cultivos) {
            throw new Error('Estructura de datos inesperada');
        }
        console.log(data); // Para depuración

        // Llenar el dropdown de sectores
        const sectorSelect = document.getElementById('id_sector');
        data.sectores.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector.id_sector; // Valor del ID del sector
            option.textContent = sector.sector; // Texto que se mostrará en el dropdown
            sectorSelect.appendChild(option); // Agrega la opción al dropdow
        });

        // Si nameTable es 'parcelacion', llenar los dropdowns de fases y cultivos
        if (nameTable === 'parcelacion') {
            // Llenar el dropdown de fases
            const faseSelect = document.getElementById('id_fase');
            data.fases.forEach(fase => {
                const option = document.createElement('option');
                option.value = fase.id_fase; // Valor del ID de la fase
                option.textContent = fase.nombre; // Texto que se mostrará en el dropdown
                faseSelect.appendChild(option); // Agrega la opción al dropdown
            });

            // Llenar el dropdown de cultivos
            const cultivoSelect = document.getElementById('id_cultivo');
            data.cultivos.forEach(cultivo => {
                const option = document.createElement('option');
                option.value = cultivo.id_cultivo; // Valor del ID del cultivo
                option.textContent = cultivo.nombre; // Texto que se mostrará en el dropdown
                cultivoSelect.appendChild(option); // Agrega la opción al dropdown
            });
        }
    } catch (error) {
        // Manejo de errores
        console.error('Error al cargar las opciones:', error);
    }
}

// Función para cargar opciones de regiones en un dropdown
async function loadOptionsRegion() {
    try {
        // Realiza una solicitud para obtener las regiones
        const response = await fetch('/api/region');


        const data = await response.json(); // Parsea la respuesta JSON
        console.log('data region opciones: ',data)
        // Llenar el dropdown de sectores
        const sectorSelect = document.getElementById('id_region');
        data.forEach(result => {
            const option = document.createElement('option');
            option.value = result.id; // Valor del ID de la región
            option.textContent = result.nombre; // Texto que se mostrará en el dropdown
            sectorSelect.appendChild(option); // Agrega la opción al dropdown
        })
    } catch (error) {
        // Manejo de errores
        console.error('Error al cargar de la region:', error);
    }};

// Función para cargar opciones de provincias en un dropdown
async function loadOptionsSector() {

    try {

        const response = await fetch('/api/sector/opciones');

        const data = await response.json(); // Parsea la respuesta JSON
        console.log('data Region y provincia opciones: ',data)
        // Llenar el dropdown de sectores
        const sectorSelect = document.getElementById('id_provincia');
        data.forEach(result => {
            const option = document.createElement('option');
            option.value = result.id_provincia; // Valor del ID de la provincia
            option.textContent = result.provincia; // Texto que se mostrará en el dropdown
            sectorSelect.appendChild(option); // Agrega la opción al dropdown
        })
    } catch (error) {
        console.error('Error al cargar de la region:', error);
    }};


/******************************************************************************/




async function loadOptionsFilter(nameTable) {
    try {
        // Realiza una solicitud para obtener las opciones
        const response = await fetch(`/api/parcelacion/opciones`);

        // Verifica si la respuesta fue exitosa
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`); // Manejo de errores HTTP
        }

        const data = await response.json(); // Parsea la respuesta JSON

        // Verifica que la estructura de datos sea la esperada
        if (!data.sectores || !data.fases || !data.cultivos) {
            throw new Error('Estructura de datos inesperada');
        }
        
        console.log(data); // Para depuración

        // Llenar el dropdown de sectores
        const sectorSelect = document.getElementById('filter_sector');
        sectorSelect.innerHTML = ''; // Limpiar el dropdown antes de llenarlo

        // Agregar la opción "Seleccione una opción"
        const defaultSectorOption = document.createElement('option');
        defaultSectorOption.value = ''; // Valor vacío
        defaultSectorOption.textContent = 'Seleccione una opción'; // Texto de la opción
        sectorSelect.appendChild(defaultSectorOption); // Agregar al dropdown

        // Solo llenar sectores si nameTable es 'cuarentena'
        if (nameTable === 'cuarentena') {
            data.sectores.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector.sector.split(", ")[1]; // Valor del ID del sector
                const nombreComuna = sector.sector.split(", ")[1]; // Toma la parte después de ", "
                option.textContent = nombreComuna; // Texto que se mostrará en el dropdown
                sectorSelect.appendChild(option); // Agrega la opción al dropdown
            });
        }

        // Si nameTable es 'parcelacion', llenar los dropdowns de sectores, fases y cultivos
        if (nameTable === 'parcelacion') {
            // Llenar el dropdown de sectores
            data.sectores.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector.sector.split(", ")[1]; // Valor del ID del sector
                const nombreComuna = sector.sector.split(", ")[1]; // Toma la parte después de ", "
                option.textContent = nombreComuna; // Texto que se mostrará en el dropdown
                sectorSelect.appendChild(option); // Agrega la opción al dropdown
            });

            // Llenar el dropdown de fases
            const faseSelect = document.getElementById('filter_fase');
            faseSelect.innerHTML = ''; // Limpiar el dropdown antes de llenarlo

            // Agregar la opción "Seleccione una opción"
            const defaultFaseOption = document.createElement('option');
            defaultFaseOption.value = ''; // Valor vacío
            defaultFaseOption.textContent = 'Seleccione una opción'; // Texto de la opción
            faseSelect.appendChild(defaultFaseOption); // Agregar al dropdown

            data.fases.forEach(fase => {
                const option = document.createElement('option');
                option.value = fase.nombre; // Valor del ID de la fase
                option.textContent = fase.nombre; // Texto que se mostrará en el dropdown
                faseSelect.appendChild(option); // Agrega la opción al dropdown
            });

            // Llenar el dropdown de cultivos
            const cultivoSelect = document.getElementById('filter_cultivo');
            cultivoSelect.innerHTML = ''; // Limpiar el dropdown antes de llenarlo

            // Agregar la opción "Seleccione una opción"
            const defaultCultivoOption = document.createElement('option');
            defaultCultivoOption.value = ''; // Valor vacío
            defaultCultivoOption.textContent = 'Seleccione una opción'; // Texto de la opción
            cultivoSelect.appendChild(defaultCultivoOption); // Agregar al dropdown

            data.cultivos.forEach(cultivo => {
                const option = document.createElement('option');
                option.value = cultivo.nombre; // Valor del ID del cultivo
                option.textContent = cultivo.nombre; // Texto que se mostrará en el dropdown
                cultivoSelect.appendChild(option); // Agrega la opción al dropdown
            });
        }
    } catch (error) {
        // Manejo de errores
        console.error('Error al cargar las opciones:', error);
    }
}


// Función para cargar opciones de regiones en un dropdown
async function loadOptionsRegionFilter() {
    try {
        // Realiza una solicitud para obtener las regiones
        const response = await fetch('/api/region');


        const data = await response.json(); // Parsea la respuesta JSON
        console.log('data region opciones: ',data)
        // Llenar el dropdown de sectores
        const filterRegion = document.getElementById('filter_region'); // Asegúrate de que este ID sea correcto

        data.forEach(result => {
            const filterOption = document.createElement('option');
            filterOption.value = result.nombre; // Valor del ID de la región
            filterOption.textContent = result.nombre; // Texto que se mostrará en el dropdown
            filterRegion.appendChild(filterOption); // Agrega la opción al dropdown
        });
    } catch (error) {
        // Manejo de errores
        console.error('Error al cargar de la region:', error);
    }};



    async function loadOptionsSectorFilter() {
        try {
            const response = await fetch('/api/sector/');
            const data = await response.json(); // Parsea la respuesta JSON
            console.log('data Region y provincia opciones: ', data);
    
            // Llenar el dropdown de sectores
            const sectorSelect = document.getElementById('filter_provincia');
            const uniqueProvincias = new Set(); // Usar un Set para evitar duplicados
    
            data.forEach(result => {
                const provincia = result.provincia;
                if (!uniqueProvincias.has(provincia)) { // Verifica si ya se ha agregado
                    uniqueProvincias.add(provincia); // Agrega la provincia al Set
                    const option = document.createElement('option');
                    option.value = provincia; // Valor del ID de la provincia
                    option.textContent = provincia; // Texto que se mostrará en el dropdown
                    sectorSelect.appendChild(option); // Agrega la opción al dropdown
                }
            });
        } catch (error) {
            console.error('Error al cargar de la provincia:', error);
        }
    }
    

    // Centrar objetos de la tabla
    document.addEventListener('DOMContentLoaded', function() {
        function centerTableData() {
            const table = document.getElementById('itemsTable');
            const cells = table.getElementsByTagName('td');
            for (let cell of cells) {
                cell.classList.add('text-center');
            }
        }

        const observer = new MutationObserver(centerTableData);
        observer.observe(document.getElementById('itemList'), { childList: true, subtree: true });

        centerTableData();
    });




/************************** OPCIONES PARA LOS SELECTS *****************************/
    // FILTROS QUE SE LLEGAN A OCUPAR EN LA FUNCION loadItems() PARA CARGAR LOS DATOS CON LOS FILTROS

    // EL QUE RESETEA LOS LOS EVENTOS DEL CLIC DE LOS FILTROS
    let filterButtonAdded = false; // Variable de control

/************************** FILTRO_PARCELACION *****************************/
    

// Verificamos si el eventListener ya fue agregado
if (!filterButtonAdded && nameTable === 'parcelacion') {
    const filterButton = document.getElementById('filterButton');
    filterButton.addEventListener('click', () => {
        const selectedSectors = Array.from(document.getElementById('filter_sector').selectedOptions).map(option => option.value);
        const selectedPhases = Array.from(document.getElementById('filter_fase').selectedOptions).map(option => option.value);
        const selectedCrops = Array.from(document.getElementById('filter_cultivo').selectedOptions).map(option => option.value);
        const selectedRegistered = Array.from(document.getElementById('filter_registrada').selectedOptions).map(option => option.value);

        // Loguear los valores seleccionados
        console.log('Filtros seleccionados:', {
            sectors: selectedSectors,
            phases: selectedPhases,
            crops: selectedCrops,
            registered: selectedRegistered
        });

        // Llamar a la función para cargar ítems filtrados
        loadItems('parcelacion', selectedSectors, selectedPhases, selectedCrops, selectedRegistered);
    });

    filterButtonAdded = true; // Marcamos que ya fue agregado
}


/************************** FILTRO_PROVINCIA*****************************/

// Verificamos si el eventListener ya fue agregado
if (!filterButtonAdded && nameTable === 'provincia') {
    const filterButton = document.getElementById('filterButton');
    filterButton.addEventListener('click', () => {
        const selectedRegiones = Array.from(document.getElementById('filter_region').selectedOptions).map(option => option.value);

        // Loguear los valores seleccionados
        console.log('Filtros seleccionados:', {
            regiones: selectedRegiones
        });

        // Llamar a la función para cargar ítems filtrados
        loadItems('provincia', undefined, undefined, undefined, undefined, selectedRegiones);
    });

    filterButtonAdded = true; // Marcamos que ya fue agregado
}

/************************** FILTRO_SECTOR*****************************/
// Verificamos si el eventListener ya fue agregado
if (!filterButtonAdded && nameTable === 'sector') {
    const filterButton = document.getElementById('filterButton');
    filterButton.addEventListener('click', () => {
        const selectedProvincia = Array.from(document.getElementById('filter_provincia').selectedOptions).map(option => option.value);

        // Loguear los valores seleccionados
        console.log('Filtros seleccionados:', {
            provincias: selectedProvincia
        });

        // Llamar a la función para cargar ítems filtrados
        loadItems('sector', undefined, undefined, undefined, undefined, undefined, selectedProvincia);
    });

    filterButtonAdded = true; // Marcamos que ya fue agregado
}


/************************** FILTRO_CUARENTENA*****************************/
// Verificamos si el eventListener ya fue agregado
if (!filterButtonAdded && nameTable === 'cuarentena') {
    const filterButton = document.getElementById('filterButton');
    filterButton.addEventListener('click', () => {
        const selectedSectors = Array.from(document.getElementById('filter_sector').selectedOptions).map(option => option.value);
        const selectedRadio = Array.from(document.getElementById('filter_radio').selectedOptions).map(option => option.value);

        // Loguear los valores seleccionados
        console.log('Filtros seleccionados:', {
            sectors: selectedSectors,
            radio: selectedRadio
        });

        // Llamar a la función para cargar ítems filtrados
        loadItems('cuarentena', selectedSectors, undefined, undefined, undefined, undefined, undefined, selectedRadio);
    });

    filterButtonAdded = true; // Marcamos que el eventListener ya fue agregado
}


/************************** FILTRO_USUARIO*****************************/
// Añadir el event listener al botón de filtrar
const filterButton = document.getElementById('filterButton');
filterButton.addEventListener('click', () => {
    const selectedRol = Array.from(document.getElementById('filter_rol').selectedOptions).map(option => option.value);
    
    // Loguear los valores seleccionados
    console.log('Filtros seleccionados:', {
        roles: selectedRol
    });



    // Llamar a la función para cargar ítems filtrados
    loadItems('usuario', undefined, undefined, undefined, undefined, undefined, undefined, undefined, selectedRol);
});
// Llena un <select> de roles desde la BDD (para que aparezcan los roles nuevos
// creados en Gestión de Roles). 'selected' preselecciona un código de rol.
async function poblarRolesSelect(selectId, selected) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  try {
    const res = await fetch('/api/rol/opciones', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return; // deja la opción placeholder
    const roles = await res.json();
    const actual = selected != null ? String(selected).toLowerCase() : '';
    sel.innerHTML = '<option value="">Seleccione rol</option>' +
      roles.map(r => `<option value="${r.codigo}">${r.nombre}</option>`).join('');
    if (actual) sel.value = actual;
    if (window.enhanceSelect) window.enhanceSelect(sel);  // dropdown diseñado de la app
  } catch (e) {
    console.error('No se pudieron cargar los roles:', e);
  }
}

;
/* ===== multiselect.js ===== */
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
      p.style.width = ''; p.style.right = ''; p.style.zIndex = '';
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
    p.style.left = r.left + 'px';
    p.style.top = (r.bottom + 6) + 'px';
    p.style.width = r.width + 'px';
    p.style.right = 'auto';
    p.style.zIndex = '2000';
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

