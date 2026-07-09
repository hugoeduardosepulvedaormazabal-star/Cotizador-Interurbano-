const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// URL de la aplicación web de Google Apps Script
// Una vez que completes la implementación del Apps Script en tu Google Sheet,
// pega aquí la URL generada (ej: https://script.google.com/macros/s/.../exec)
const GOOGLE_SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwmVsN2XAk9altHE4SorjBa4BSDoHoDMQtP0oIunQTyxsu6GqwkUkZelTRZxJrANOF31A/exec';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Función auxiliar para enviar los datos de cotización a Google Sheets siguiendo redirecciones
function enviarAGoogleSheets(payload, callback) {
    if (!GOOGLE_SHEET_WEBAPP_URL || GOOGLE_SHEET_WEBAPP_URL.trim() === '') {
        console.log('[Sheets Proxy] URL de Google Sheets no configurada. Funcionando en modo simulación.');
        callback(null, { simulation: true });
        return;
    }

    const hacerPeticion = (url, data) => {
        const urlObj = new URL(url);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(urlObj, options, (res) => {
            // Google Apps Script suele redirigir temporalmente (código 302 o 307)
            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
                const redirectUrl = res.headers.location;
                if (redirectUrl) {
                    hacerPeticion(redirectUrl, data);
                } else {
                    callback(new Error('El servidor de Google solicitó redirección pero no entregó la cabecera Location.'));
                }
            } else {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        callback(null, parsed);
                    } catch (e) {
                        callback(null, { rawResponse: body, statusCode: res.statusCode });
                    }
                });
            }
        });

        req.on('error', (err) => {
            callback(err);
        });

        req.write(data);
        req.end();
    };

    hacerPeticion(GOOGLE_SHEET_WEBAPP_URL, payload);
}

const server = http.createServer((req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // Endpoint API para guardar cotizaciones
    if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            enviarAGoogleSheets(body, (err, result) => {
                if (err) {
                    console.error('[Sheets Proxy Error]', err.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: false, error: err.message }));
                } else {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: true, result }));
                }
            });
        });
        return;
    }

    // Normalizar la URL de la solicitud
    let filePath = req.url === '/' 
        ? path.join(__dirname, 'index.html') 
        : path.join(__dirname, req.url.split('?')[0]); // Remover query params (?v=3)

    // Prevenir ataques de Directory Traversal
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Acceso denegado');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`[404] No encontrado: ${filePath}`);
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Archivo no encontrado (404)');
            } else {
                console.error(`[500] Error del servidor: ${err.message}`);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(`Error interno del servidor: ${err.code}`);
            }
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(data);
        }
    });
});

server.listen(PORT, () => {
    console.log('\n==================================================');
    console.log('   🚚 COTIZADOR DE FLETES - SERVIDOR ACTIVO 🚚');
    console.log('==================================================');
    console.log(`  El servidor está corriendo de forma local.`);
    console.log(`  👉 Abre en tu navegador: http://localhost:${PORT}`);
    console.log('  Presiona Ctrl+C en la terminal para apagarlo.\n');
});
