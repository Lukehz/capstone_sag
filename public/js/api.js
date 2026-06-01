/* api.js*/

const API_URL = 'http://localhost:3000';
/*
function updateParcelas() {
    console.log('Fetching parcelas...');
    fetch(`${API_URL}/parcelas`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(parcelas => {
            console.log('Received parcelas');
            if (!parcelas.length) {
                console.log('No se encontraron parcelas');
                return;
            }

            updateParcelasOnMap(parcelas);
        })
        .catch(error => console.error('Error fetching parcelas:', error));
}

function updateParcelasOnMap(parcelas) {
    parcelaMarkers.forEach(marker => marker.remove());
    parcelaMarkers = [];

    const bounds = new mapboxgl.LngLatBounds();
    parcelas.forEach(parcela => {
        const marker = new mapboxgl.Marker()
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
                </div>
            `))
            .addTo(map);

        parcelaMarkers.push(marker);
        bounds.extend([parcela.longitud, parcela.latitud]);
    });

    map.fitBounds(bounds, { padding: 50, duration: 0 });
}

function saveQuarantineAPI(points, comentario) {
    return fetch(`${API_URL}/save-quarantine`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            points: points,
            comentario: comentario
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Datos recibidos del servidor:', data);
        return data;
    });
}
*/