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
    { pesoMaximo: Infinity, costoPorKm: 2526 }
];

function obtenerCostoPorKm(pesoAEnviar) {
    for (let regla of MATRIZ_PRECIOS) {
        if (pesoAEnviar <= regla.pesoMaximo) {
            return regla.costoPorKm;
        }
    }
}

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

    const origenInput = document.getElementById('origin').value;
    const destinoInput = document.getElementById('destination').value;
    const pesoInput = parseFloat(document.getElementById('weight').value); 
    
    // Preparando herramientas de rescate manual
    const cajaEmergencia = document.getElementById('emergency-box');
    const valorEmergencia = parseFloat(document.getElementById('emergency-distance').value);

    // Variable booleana para decidir qué mapa usar
    let usandoRescate = false;
    let distanciaFinal = 0;

    // Si la caja ya apareció roja y el jefe ya tipeó un número (Hack para override)
    if (cajaEmergencia.style.display !== 'none' && !isNaN(valorEmergencia) && valorEmergencia > 0) {
        usandoRescate = true;
        distanciaFinal = valorEmergencia;
    }

    if (isNaN(pesoInput) || pesoInput <= 0) {
        alert("¡Cuidado! El peso debe ser un número mayor a cero.");
        return;
    }

    const boton = document.querySelector('.btn-primary');
    const textoOriginalBoton = boton.innerHTML;
    
    if (usandoRescate) {
        boton.innerHTML = "Facturando ruta manual de emergencia... 🛠️";
    } else {
        boton.innerHTML = "Localizando camión Satelital... 🌍";
    }
    boton.disabled = true;

    try {
        if (!usandoRescate) {
            // PROCESO A: Búsqueda Normal
            const coordOrigen = await buscarCoordenadas(origenInput);
            const coordDestino = await buscarCoordenadas(destinoInput);

            const resultadosRuta = await calcularDistanciaRealAutomática(coordOrigen, coordDestino);
            distanciaFinal = Math.round(resultadosRuta.distanciaKm); 

            document.getElementById('distance').value = distanciaFinal;

            dibujarRutaVisualParaCLiente(coordOrigen, coordDestino, resultadosRuta.geometriaRuta);
            
            // Garantizar limpiar si quedó abierta anterior
            cajaEmergencia.style.display = 'none';

        } else {
            // PROCESO B: Búsqueda de Rescate (Si escribiste "39" km a la fuerza)
            document.getElementById('map-container').style.display = 'none'; 
            document.getElementById('distance').value = `${distanciaFinal} km (Pasado a mano)`;
        }

        // MULTIPLICACIÓN EXCLUSIVA DE LAS TABLAS DE COBRO (Esto no cambia sea A o B)
        const tarifaPorKm = obtenerCostoPorKm(pesoInput);
        const costoTotal = distanciaFinal * tarifaPorKm;

        const textoOrigen = origenInput === "SUCURSAL_INDEPENDENCIA" ? "Bodega Independencia" : "Bodega Vespucio";
        document.getElementById('route-display').textContent = `${textoOrigen} ➔ ${destinoInput.substring(0, 15)}`;
        
        if (usandoRescate) {
            document.getElementById('distance-display').textContent = `${distanciaFinal} km (Modo Anulación/Manual)`;
        } else {
            document.getElementById('distance-display').textContent = `${distanciaFinal} km Automáticos Oficiales`;
        }

        document.getElementById('weight-display').textContent = `${pesoInput} kg`;
        document.getElementById('rate-display').textContent = `$${tarifaPorKm.toLocaleString('es-ES')} por km`;
        document.getElementById('total-cost').textContent = `$${costoTotal.toLocaleString('es-ES')}`;

        document.getElementById('result-section').style.display = 'block';

    } catch (error) {
        // ACTIVACIÓN DE LA ALARMA! El mapa Falló
        alert("PROTOCOLO DE EMERGENCIA: El satélite no halló tu calle.\n\nHe activado el Modo Rescate (cuadro rojo en el formulario). Ingresa por favor tú mismo los km usando Google Maps aparte para que podamos calcularle la cuenta al cliente.");
        cajaEmergencia.style.display = 'flex';
        document.getElementById('result-section').style.display = 'none'; // Borrar factura fallida
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
    const destinoInput = document.getElementById('destination').value;
    
    if (!destinoInput || destinoInput.trim() === '') {
        alert("Por favor ingresa primero una dirección de destino antes de revisar el mapa.");
        return;
    }

    const origenSTR = (origenInput === "SUCURSAL_INDEPENDENCIA") 
        ? "Agustín López de Alcázar 546, Independencia, Región Metropolitana, Chile" 
        : "Av. Américo Vespucio 4288, 7930053 Peñalolén, Región Metropolitana, Chile";

    const destinoBusqueda = destinoInput.toLowerCase().includes("chile") ? destinoInput : destinoInput + ", Chile";
    
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origenSTR)}&destination=${encodeURIComponent(destinoBusqueda)}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank');
}

document.getElementById('gmaps-btn')?.addEventListener('click', manejarAbrirGmaps);
document.getElementById('emergency-gmaps-btn')?.addEventListener('click', manejarAbrirGmaps);


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
