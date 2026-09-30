const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const selfsigned = require('selfsigned');

const PORT = 3000;

// Bilgisayarın yerel ağdaki (Wi-Fi/Ethernet) IP adresini bul
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// SSL Sertifikası Kontrolü:
// Telefonların kamerayı açabilmesi için HTTPS şarttır.
// Başka bilgisayarda çalıştırıldığında sertifika yoksa otomatik üretir!
const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log("🔒 SSL sertifikası bulunamadı, otomatik üretiliyor...");
    const pems = selfsigned.generate([{ name: 'commonName', value: 'WebRTC-Camera' }], { days: 365 });
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log("✅ SSL sertifikası başarıyla oluşturuldu.");
}

// HTML ve statik dosyaları sunan HTTP(S) sunucusu
const requestHandler = (req, res) => {
    let reqUrl = req.url.split('?')[0];

    // Önbelleğe almayı engelle
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // IP ve port bilgisini dönen API
    if (reqUrl === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            ip: getLocalIp(),
            port: PORT,
            protocol: 'https'
        }));
    }

    // Kısa rota eşlemeleri
    let fileName = reqUrl;
    if (fileName === '/' || fileName === '') fileName = 'index.html';
    else if (fileName === '/camera' || fileName === '/camera.html') fileName = 'camera.html';
    else if (fileName === '/viewer' || fileName === '/viewer.html') fileName = 'viewer.html';
    else fileName = fileName.replace(/^\//, '');

    let filePath = path.join(__dirname, fileName);
    const extname = path.extname(filePath);
    let contentType = 'text/html; charset=utf-8';
    if (extname === '.js') contentType = 'text/javascript';
    if (extname === '.css') contentType = 'text/css';
    if (extname === '.json') contentType = 'application/json';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Sayfa Bulunamadı');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
};

const server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
}, requestHandler);

// WebSocket sunucusunu aynı sunucuya bağlıyoruz
const wss = new WebSocket.Server({ server });

// Bağlı olan cihazlar
let cameraSocket = null;
let viewerSocket = null;

function sendSafe(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

wss.on('connection', (ws) => {
    console.log("🔌 Yeni bir cihaz bağlandı.");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register_camera':
                    cameraSocket = ws;
                    console.log("🎥 Kamera başarıyla kaydedildi.");
                    if (viewerSocket && viewerSocket.readyState === WebSocket.OPEN) {
                        console.log("📲 İzleyici hazır, kameraya 'camera_ready' gönderiliyor...");
                        sendSafe(cameraSocket, { type: 'camera_ready' });
                    }
                    break;

                case 'register_viewer':
                    viewerSocket = ws;
                    console.log("📱 İzleyici başarıyla kaydedildi.");
                    if (cameraSocket && cameraSocket.readyState === WebSocket.OPEN) {
                        console.log("🎥 Kamera hazır, kameraya 'camera_ready' gönderiliyor...");
                        sendSafe(cameraSocket, { type: 'camera_ready' });
                    } else {
                        sendSafe(viewerSocket, { type: 'waiting_for_camera' });
                    }
                    break;

                case 'offer':
                    console.log("📩 Teklif (Offer) izleyiciye iletiliyor...");
                    sendSafe(viewerSocket, data);
                    break;

                case 'answer':
                    console.log("📩 Cevap (Answer) kameraya iletiliyor...");
                    sendSafe(cameraSocket, data);
                    break;

                case 'ice_candidate':
                    if (ws === cameraSocket) {
                        sendSafe(viewerSocket, data);
                    } else if (ws === viewerSocket) {
                        sendSafe(cameraSocket, data);
                    }
                    break;
            }
        } catch (error) {
            console.error("❌ Mesaj işleme hatası:", error);
        }
    });

    ws.on('close', () => {
        if (ws === cameraSocket) {
            console.log("❌ Kamera bağlantısı koptu.");
            cameraSocket = null;
            sendSafe(viewerSocket, { type: 'camera_disconnected' });
        } else if (ws === viewerSocket) {
            console.log("❌ İzleyici bağlantısı koptu.");
            viewerSocket = null;
            sendSafe(cameraSocket, { type: 'viewer_disconnected' });
        }
    });
});

const localIp = getLocalIp();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 WebRTC Yerel Kamera Sunucusu Başlatıldı!`);
    console.log(`-------------------------------------------------------------`);
    console.log(`💻 Bilgisayarda Açmak İçin:`);
    console.log(`   https://localhost:${PORT}`);
    console.log(``);
    console.log(`📱 Telefonda Açmak İçin (Aynı Wi-Fi):`);
    console.log(`   https://${localIp}:${PORT}`);
    console.log(`   🎥 Kamera:  https://${localIp}:${PORT}/camera.html`);
    console.log(`   📱 İzleyici: https://${localIp}:${PORT}/viewer.html`);
    console.log(`=============================================================\n`);
});
