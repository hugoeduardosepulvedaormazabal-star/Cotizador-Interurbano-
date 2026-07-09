/**
 * MATRIZ DE PRECIOS
 * Valores corregidos a "miles", es decir, 1619 pesos en lugar de un dólar con centavos.
 */
const MATRIZ_PRECIOS = [
    { pesoMaximo: 1000, costoPorKm: 1619 },
    { pesoMaximo: 2000, costoPorKm: 1684 },
    { pesoMaximo: 3000, costoPorKm: 1749 },
    { pesoMaximo: 4000, costoPorKm: 1814 },
    { pesoMaximo: 5000, costoPorKm: 1878 },
    { pesoMaximo: 6000, costoPorKm: 1943 },
    { pesoMaximo: 7000, costoPorKm: 2008 },
    { pesoMaximo: 8000, costoPorKm: 2073 },
    { pesoMaximo: 9000, costoPorKm: 2137 },
    { pesoMaximo: 10000, costoPorKm: 2202 },
    { pesoMaximo: 11000, costoPorKm: 2267 },
    { pesoMaximo: 12000, costoPorKm: 2332 },
    { pesoMaximo: 13000, costoPorKm: 2396 },
    { pesoMaximo: 14000, costoPorKm: 2461 },
    { pesoMaximo: 15000, costoPorKm: 2526 }
];

function obtenerCostoPorKm(pesoAEnviar) {
    for (let regla of MATRIZ_PRECIOS) {
        if (pesoAEnviar <= regla.pesoMaximo) {
            return regla.costoPorKm;
        }
    }
}

// Variable global para guardar el destino exacto provisto por Google Maps
let lugarDestinoGoogle = null;

// ==========================================================
// POBLAR TABLA DE TARIFARIO DINÁMICAMENTE
// ==========================================================
function poblarTablaTarifario() {
    const tbody = document.getElementById('tariff-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let pesoAnterior = 0;
    MATRIZ_PRECIOS.forEach((regla, index) => {
        const tr = document.createElement('tr');
        tr.dataset.index = index;
        tr.dataset.pesoMax = regla.pesoMaximo;

        const tdPeso = document.createElement('td');
        tdPeso.textContent = `${(pesoAnterior + 1).toLocaleString('es-CL')} – ${regla.pesoMaximo.toLocaleString('es-CL')} kg`;

        const tdCosto = document.createElement('td');
        tdCosto.textContent = `$${regla.costoPorKm.toLocaleString('es-CL')}`;

        tr.appendChild(tdPeso);
        tr.appendChild(tdCosto);
        tbody.appendChild(tr);

        pesoAnterior = regla.pesoMaximo;
    });
}

// Resaltar la fila activa del tarifario según el peso ingresado
function resaltarFilaTarifario(peso) {
    const rows = document.querySelectorAll('#tariff-body tr');
    rows.forEach(row => row.classList.remove('active-row'));

    for (let i = 0; i < MATRIZ_PRECIOS.length; i++) {
        if (peso <= MATRIZ_PRECIOS[i].pesoMaximo) {
            if (rows[i]) {
                rows[i].classList.add('active-row');
                rows[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            break;
        }
    }
}

// ==========================================================
// INICIALIZACIÓN DEL MAPA BASE
// ==========================================================
function inicializarMapaBase() {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;

    if (!mapaVisual) {
        // Santiago coords por defecto
        mapaVisual = L.map('map').setView([-33.4569, -70.6483], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(mapaVisual);
    }
}

// ==========================================================
// INICIALIZACIÓN DEL PLACE PICKER (Autocompletado de Mapas Seguro)
// ==========================================================
async function initPlacePicker() {
    // Usamos el Autocomplete estándar en un input de texto para no bloquear la pantalla
    // si falla la llave API. Así siempre serás capaz de teclear a mano y usar Nominatim.
    const inputElement = document.getElementById('destination');
    
    try {
        if (typeof google === 'undefined' || !google.maps) {
            throw new Error("El SDK de Google Maps no está cargado.");
        }
        // Esperamos a que la librería 'places' de Google esté disponible
        await google.maps.importLibrary("places");
        
        const autocomplete = new google.maps.places.Autocomplete(inputElement, {
            fields: ["geometry", "name", "formatted_address"],
            componentRestrictions: { country: "cl" } // Restringir a Chile para evitar resultados internacionales
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();

            if (!place.geometry || !place.geometry.location) {
                lugarDestinoGoogle = null;
                return;
            }

            lugarDestinoGoogle = {
                lat: place.geometry.location.lat(),
                lon: place.geometry.location.lng(),
                nombre: place.name || place.formatted_address
            };

            if (mapaVisual) {
                if (place.geometry.viewport) {
                    const nf = place.geometry.viewport.getNorthEast();
                    const sw = place.geometry.viewport.getSouthWest();
                    mapaVisual.fitBounds([
                        [sw.lat(), sw.lng()],
                        [nf.lat(), nf.lng()]
                    ]);
                } else {
                    mapaVisual.setView([lugarDestinoGoogle.lat, lugarDestinoGoogle.lon], 17);
                }
            }
        });
    } catch(err) {
        console.warn("Google Maps no cargó correctamente, funcionando en modo manual/fallback", err);
    }
    
    // Si el usuario edita o borra el input después de elegir una sugerencia, limpiamos la variable autocompletada
    inputElement.addEventListener('input', () => {
        lugarDestinoGoogle = null;
    });
}

// Al cargar la página, intentar inicializar Google Maps Autocomplete tras 1s para asegurar carga de scripts
document.addEventListener('DOMContentLoaded', () => {
    inicializarMapaBase();
    setTimeout(initPlacePicker, 500);
    poblarTablaTarifario();

    // Establecer fecha de cotización actual
    const printDateElement = document.getElementById('print-date');
    if (printDateElement) {
        printDateElement.textContent = new Date().toLocaleDateString('es-CL');
    }

    // Toggle manual km box
    const manualToggle = document.getElementById('manual-km-toggle');
    const manualBox = document.getElementById('manual-km-box');
    if (manualToggle && manualBox) {
        manualToggle.addEventListener('change', () => {
            manualBox.style.display = manualToggle.checked ? 'block' : 'none';
        });
    }

    // Toggle tariff table collapse
    const tariffBtn = document.getElementById('tariff-toggle-btn');
    const tariffWrapper = document.getElementById('tariff-table-wrapper');
    const tariffArrow = document.getElementById('tariff-arrow');
    if (tariffBtn && tariffWrapper) {
        tariffBtn.addEventListener('click', () => {
            tariffWrapper.classList.toggle('collapsed');
            if (tariffArrow) tariffArrow.classList.toggle('collapsed');
        });
    }

    // Manual Google Maps button
    document.getElementById('manual-gmaps-btn')?.addEventListener('click', manejarAbrirGmaps);
});

async function buscarCoordenadas(direccion) {
    // ATENCIÓN: Si la ruta empieza en alguna de nuestras bodegas, le damos
    // la latitud y longitud directamente en lugar de consultarle a internet!
    if (direccion === "SUCURSAL_INDEPENDENCIA") return { lon: -70.657090, lat: -33.426840 };
    if (direccion === "SUCURSAL_VESPUCIO") return { lon: -70.584315, lat: -33.496170 };

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (datos && datos.length > 0) {
        return { lon: datos[0].lon, lat: datos[0].lat };
    } else {
        throw new Error(`No pude encontrar esta dirección en el mapa global: ${direccion}`);
    }
}

/**
 * MAGIA NEGRA 2 ACTUALIZADA: Ahora también pide el "dibujo" (geometría) de la ruta.
 */
async function calcularDistanciaRealAutomática(origenCoords, destinoCoords) {
    const coordsStr = `${origenCoords.lon},${origenCoords.lat};${destinoCoords.lon},${destinoCoords.lat}`;
    
    // Aquí agregamos &geometries=geojson para decirle al sistema que nos devuelva el mapa de la carretera
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=simplified&geometries=geojson`;
    
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (datos.code === 'Ok' && datos.routes.length > 0) {
        const rutaData = datos.routes[0];
        const distanciaMetros = rutaData.distance;
        
        return {
            distanciaKm: distanciaMetros / 1000,
            geometriaRuta: rutaData.geometry // ¡Retornamos las líneas matemáticas para dibujarlas luego!
        };
    } else {
        throw new Error("No hay una carretera válida registrada entre esos dos puntos.");
    }
}

// Variables en memoria para guardar el mapa interactivo
let mapaVisual;
let dibujoRuta;
let pinOrigen;
let pinDestino;

function dibujarRutaVisualParaCLiente(coordOrigen, coordDestino, geometriaGeoJSON) {
    // 1. Mostrar la "caja" del mapa en la pantalla del navegador
    document.getElementById('map-container').style.display = 'block';

    // 2. Si el mapa no se ha cargado aún, lo creamos
    if (!mapaVisual) {
        // La librería L (Leaflet) es la que acabamos de instalar en tu index.html
        mapaVisual = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(mapaVisual);
    }

    // 3. Limpiar dibujos viejos si volvemos a calcular una nueva ruta
    if (dibujoRuta) mapaVisual.removeLayer(dibujoRuta);
    if (pinOrigen) mapaVisual.removeLayer(pinOrigen);
    if (pinDestino) mapaVisual.removeLayer(pinDestino);

    // 4. Dibujar la línea de la carretera nueva
    dibujoRuta = L.geoJSON(geometriaGeoJSON, {
        style: { color: '#10b981', weight: 5, opacity: 0.9 }
    }).addTo(mapaVisual);

    // 5. Poner los globitos marcadores ("Pines")
    pinOrigen = L.marker([coordOrigen.lat, coordOrigen.lon]).addTo(mapaVisual).bindPopup('Inicio del Viaje');
    pinDestino = L.marker([coordDestino.lat, coordDestino.lon]).addTo(mapaVisual).bindPopup('Destino Final');

    // 6. Centrar la pantalla para que el cliente vea el país o ciudades enteras
    mapaVisual.fitBounds(dibujoRuta.getBounds(), { padding: [30, 30] });

    // Corrección técnica: Asegurarnos de que el mapa llene todo su cuadro nuevo
    setTimeout(() => {
        mapaVisual.invalidateSize();
        mapaVisual.fitBounds(dibujoRuta.getBounds(), { padding: [30, 30] });
    }, 100);
}

// ==========================================================
// LÓGICA PRINCIPAL AL PRESIONAR EL BOTÓN
// ==========================================================

const formulario = document.getElementById('freight-form');

formulario.addEventListener('submit', async function(evento) {
    evento.preventDefault();

    const usernameInput = document.getElementById('username').value;
    const origenInput = document.getElementById('origin').value;
    
    // Obtenemos el valor tipeado en la casilla de texto normal
    const inputCasilla = document.getElementById('destination').value;
    const destinoNombreAUsar = lugarDestinoGoogle ? lugarDestinoGoogle.nombre : inputCasilla;

    const pesoInput = parseFloat(document.getElementById('weight').value); 
    
    // Verificar si el usuario ingresó km manuales
    const manualKmInput = document.getElementById('manual-km');
    const manualKmValue = manualKmInput ? parseFloat(manualKmInput.value) : NaN;
    const usandoManualKm = !isNaN(manualKmValue) && manualKmValue > 0;

    let distanciaFinal = 0;

    if (isNaN(pesoInput) || pesoInput <= 0) {
        alert("¡Cuidado! El peso debe ser un número mayor a cero.");
        return;
    }

    if (pesoInput > 15000) {
        alert("⚠️ El peso máximo que trasladamos es de 15.000 kg. Por favor ingresa un valor menor o igual.");
        return;
    }

    const boton = formulario.querySelector('button[type="submit"]');
    const textoOriginalBoton = boton.innerHTML;
    
    if (usandoManualKm) {
        boton.innerHTML = "Calculando con distancia manual... ✏️";
    } else {
        boton.innerHTML = "Localizando camión Satelital... 🌍";
    }
    boton.disabled = true;

    try {
        if (usandoManualKm) {
            // PROCESO B: Km Manual
            distanciaFinal = manualKmValue;
            document.getElementById('distance').value = `${distanciaFinal} km (Manual)`;
            // Intentar dibujar el mapa de todas formas si tenemos destino
            try {
                const coordOrigen = await buscarCoordenadas(origenInput);
                let coordDestino;
                if (lugarDestinoGoogle) {
                    coordDestino = { lat: lugarDestinoGoogle.lat, lon: lugarDestinoGoogle.lon };
                } else if (destinoNombreAUsar) {
                    coordDestino = await buscarCoordenadas(destinoNombreAUsar);
                }
                if (coordDestino) {
                    const resultadosRuta = await calcularDistanciaRealAutomática(coordOrigen, coordDestino);
                    dibujarRutaVisualParaCLiente(coordOrigen, coordDestino, resultadosRuta.geometriaRuta);
                }
            } catch(e) {
                // No pasa nada si el mapa falla, usamos la distancia manual de todas formas
                document.getElementById('map-container').style.display = 'none';
            }

        } else {
            // PROCESO A: Búsqueda Normal Automática
            if (!lugarDestinoGoogle && !destinoNombreAUsar) {
                alert("Por favor selecciona una dirección de destino válida.");
                boton.innerHTML = textoOriginalBoton;
                boton.disabled = false;
                return;
            }

            const coordOrigen = await buscarCoordenadas(origenInput);
            
            let coordDestino;
            if (lugarDestinoGoogle) {
                coordDestino = { lat: lugarDestinoGoogle.lat, lon: lugarDestinoGoogle.lon };
            } else {
                coordDestino = await buscarCoordenadas(destinoNombreAUsar);
            }

            const resultadosRuta = await calcularDistanciaRealAutomática(coordOrigen, coordDestino);
            distanciaFinal = Math.round(resultadosRuta.distanciaKm); 

            document.getElementById('distance').value = distanciaFinal;

            dibujarRutaVisualParaCLiente(coordOrigen, coordDestino, resultadosRuta.geometriaRuta);
        }

        // MULTIPLICACIÓN EXCLUSIVA DE LAS TABLAS DE COBRO (Esto no cambia sea A o B)
        const tarifaPorKm = obtenerCostoPorKm(pesoInput);
        const costoTotal = distanciaFinal * tarifaPorKm;

        const storeInput = document.getElementById('store').value;
        document.getElementById('username-display').textContent = usernameInput;
        document.getElementById('store-display').textContent = storeInput;

        const textoOrigen = origenInput === "SUCURSAL_INDEPENDENCIA" ? "Bodega Independencia" : "Bodega Vespucio";
        document.getElementById('route-display').textContent = `${textoOrigen} ➔ ${(destinoNombreAUsar || "").substring(0, 25)}...`;
        
        if (usandoManualKm) {
            document.getElementById('distance-display').textContent = `${distanciaFinal} km (Ingreso Manual ✏️)`;
        } else {
            document.getElementById('distance-display').textContent = `${distanciaFinal} km Automáticos Oficiales`;
        }

        document.getElementById('weight-display').textContent = `${pesoInput} kg`;
        document.getElementById('rate-display').textContent = `$${tarifaPorKm.toLocaleString('es-ES')} por km`;
        document.getElementById('total-cost').textContent = `$${costoTotal.toLocaleString('es-ES')}`;

        document.getElementById('result-section').style.display = 'block';

        // Guardar cotización en Google Sheets en segundo plano
        guardarCotizacionEnSheets({
            username: usernameInput,
            store: storeInput,
            origin: origenInput === "SUCURSAL_INDEPENDENCIA" ? "Bodega Independencia" : "Bodega Vespucio",
            destination: destinoNombreAUsar,
            distance: distanciaFinal,
            isManualDistance: usandoManualKm,
            weight: pesoInput,
            ratePerKm: tarifaPorKm,
            totalCost: costoTotal
        });

        // NUEVO: Resaltar fila activa en el tarifario
        resaltarFilaTarifario(pesoInput);

    } catch (error) {
        // El satélite falló: activar automáticamente el toggle de km manuales
        const manualToggle = document.getElementById('manual-km-toggle');
        const manualBox = document.getElementById('manual-km-box');
        if (manualToggle) manualToggle.checked = true;
        if (manualBox) manualBox.style.display = 'block';
        
        alert("El satélite no pudo encontrar la ruta automáticamente.\n\nSe activó el ingreso manual de kilómetros. Por favor ingresa la distancia usando Google Maps como referencia.");
        document.getElementById('result-section').style.display = 'none';
    } finally {
        boton.innerHTML = textoOriginalBoton;
        boton.disabled = false;
    }
});

// ==========================================================
// LÓGICA DE AMPLIAR MAPA A PANTALLA COMPLETA
// ==========================================================
const cajonMapa = document.getElementById('map-container');
const btnExpandir = document.getElementById('fullscreen-btn');
const btnCerrar = document.getElementById('close-fullscreen-btn');

btnExpandir.addEventListener('click', () => {
    cajonMapa.classList.add('ampliado'); // Activa el CSS oculto (100% pantalla)
    btnExpandir.style.display = 'none';  // Ocultar botón ampliar
    btnCerrar.style.display = 'block';   // Mostrar el rojo de cerrar

    // Hacer que el mapa reaccione al nuevo tamaño de pantalla usando temporizador
    setTimeout(() => {
        mapaVisual.invalidateSize();
        if (dibujoRuta) {
            mapaVisual.fitBounds(dibujoRuta.getBounds(), { padding: [50, 50] });
        }
    }, 200);
});

btnCerrar.addEventListener('click', () => {
    cajonMapa.classList.remove('ampliado'); // Regresar a tamaño normal de caja
    btnCerrar.style.display = 'none';
    btnExpandir.style.display = 'block';

    setTimeout(() => {
        mapaVisual.invalidateSize();
        if (dibujoRuta) {
            mapaVisual.fitBounds(dibujoRuta.getBounds(), { padding: [30, 30] });
        }
    }, 200);
});

// ==========================================================
// BOTÓN DE IMPRIMIR COTIZACIÓN
// ==========================================================
document.getElementById('print-btn')?.addEventListener('click', () => {
    window.print();
});

// ==========================================================
// ABRIR EN GOOGLE MAPS EXTERNO
// ==========================================================
function manejarAbrirGmaps() {
    const origenInput = document.getElementById('origin').value;
    
    const inputCasilla = document.getElementById('destination').value;
    const destinoSeleccionado = lugarDestinoGoogle ? lugarDestinoGoogle.nombre : inputCasilla;
    
    if (!destinoSeleccionado || destinoSeleccionado.trim() === '') {
        alert("Por favor ingresa primero una dirección de destino antes de revisar el mapa.");
        return;
    }

    const origenSTR = (origenInput === "SUCURSAL_INDEPENDENCIA") 
        ? "Agustín López de Alcázar 546, Independencia, Región Metropolitana, Chile" 
        : "Av. Américo Vespucio 4288, 7930053 Peñalolén, Región Metropolitana, Chile";

    const destinoBusqueda = destinoSeleccionado.toLowerCase().includes("chile") ? destinoSeleccionado : destinoSeleccionado + ", Chile";
    
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origenSTR)}&destination=${encodeURIComponent(destinoBusqueda)}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank');
}

document.getElementById('gmaps-btn')?.addEventListener('click', manejarAbrirGmaps);



// ==========================================================
// OCULTAR / MOSTRAR MAPA LOCAL y TECLA ESCAPE
// ==========================================================
const toggleMapBtn = document.getElementById('toggle-map-btn');
if (toggleMapBtn) {
    toggleMapBtn.addEventListener('click', () => {
        const mapaContainer = document.getElementById('map-container');
        if (mapaContainer.style.display === 'none') {
            mapaContainer.style.display = 'block';
            toggleMapBtn.innerHTML = '👁️ Esconder Mapa';
            setTimeout(() => {
                if (mapaVisual) mapaVisual.invalidateSize();
            }, 200);
        } else {
            mapaContainer.style.display = 'none';
            toggleMapBtn.innerHTML = '🗺️ Mostrar Mapa';
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const cajonMapa = document.getElementById('map-container');
        const btnCerrar = document.getElementById('close-fullscreen-btn');
        if (cajonMapa && cajonMapa.classList.contains('ampliado') && btnCerrar) {
            btnCerrar.click();
        }
    }
});

// Enviar datos de cotización al proxy para guardado en Google Sheets
async function guardarCotizacionEnSheets(datos) {
    try {
        const respuesta = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        });
        const resJSON = await respuesta.json();
        if (resJSON.success) {
            console.log('[Sheets Logging] Cotización guardada con éxito:', resJSON.result);
            if (resJSON.result && resJSON.result.simulation) {
                console.log('[Sheets Logging] Modo simulación activo. Configure la URL de Google Sheets en server.js.');
            }
        } else {
            console.warn('[Sheets Logging Error]', resJSON.error);
        }
    } catch (e) {
        console.error('[Sheets Logging Network Error]', e);
    }
}
