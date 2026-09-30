const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const isCloud = !!process.env.PORT; // Bulut platformlarında (Render/Railway vb.) PORT env tanımlıdır

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

const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');
const hasSsl = fs.existsSync(keyPath) && fs.existsSync(certPath);

// HTML ve statik dosyaları sunmak için istek işleyici
const requestHandler = (req, res) => {
    let reqUrl = req.url.split('?')[0];

    // Cihaz ve IP bilgisi döndüren API
    if (reqUrl === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            ip: isCloud ? req.headers.host : getLocalIp(),
            port: PORT,
            protocol: isCloud ? 'https' : (hasSsl ? 'https' : 'http'),
            isCloud: isCloud
        }));
    }

    let filePath = path.join(__dirname, reqUrl === '/' ? 'index.html' : reqUrl);
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

// Bulutta çalışıyorsa (Render/Railway vb. önünde SSL proxy vardır) HTTP başlatıyoruz
// Yerel bilgisayarda çalışıyorsa ve sertifika varsa HTTPS başlatıyoruz
let server;
let protoName;
if (!isCloud && hasSsl) {
    server = https.createServer({
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    }, requestHandler);
    protoName = 'https';
} else {
    server = http.createServer(requestHandler);
    protoName = isCloud ? 'https' : 'http';
}

// WebSocket sunucusunu aynı sunucuya bağlıyoruz
const wss = new WebSocket.Server({ server });

server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`\n=============================================================`);
    console.log(`🚀 WebRTC Sunucusu Başlatıldı! (Port: ${PORT})`);
    if (isCloud) {
        console.log(`🌍 Bulut Ortamında Çalışıyor (Render/Railway)`);
    } else {
        console.log(`💻 Bilgisayarda Test: ${protoName}://localhost:${PORT}`);
        console.log(`📱 Telefonda Test (Wi-Fi): ${protoName}://${localIp}:${PORT}`);
    }
    console.log(`=============================================================\n`);
});

// Bağlı olan cihazları hafızada tutmak için değişkenler
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
                // 1. Cihaz kendini "Kamera" olarak kaydediyor
                case 'register_camera':
                    cameraSocket = ws;
                    console.log("🎥 Eski Telefon (Kamera) başarıyla kaydedildi.");
                    // Eğer izleyici zaten bağlı bekliyorsa, kameraya yayını başlatması için haber ver
                    if (viewerSocket && viewerSocket.readyState === WebSocket.OPEN) {
                        console.log("📲 İzleyici zaten hazır, kameraya 'camera_ready' gönderiliyor...");
                        sendSafe(cameraSocket, { type: 'camera_ready' });
                    }
                    break;

                // 2. Cihaz kendini "İzleyici" olarak kaydediyor
                case 'register_viewer':
                    viewerSocket = ws;
                    console.log("📱 Yeni Telefon (İzleyici) başarıyla kaydedildi.");
                    // Eğer kamera bağlıysa, kameraya teklif (offer) oluşturması için haber ver
                    if (cameraSocket && cameraSocket.readyState === WebSocket.OPEN) {
                        console.log("🎥 Kamera hazır, kameraya 'camera_ready' gönderiliyor...");
                        sendSafe(cameraSocket, { type: 'camera_ready' });
                    } else {
                        sendSafe(viewerSocket, { type: 'waiting_for_camera' });
                    }
                    break;

                // 3. WebRTC El Sıkışma Mesajları (Offer, Answer, ICE Candidate)
                case 'offer':
                    console.log("📩 Kameradan Teklif (Offer) geldi, İzleyiciye gönderiliyor...");
                    sendSafe(viewerSocket, data);
                    break;

                case 'answer':
                    console.log("📩 İzleyiciden Cevap (Answer) geldi, Kameraya gönderiliyor...");
                    sendSafe(cameraSocket, data);
                    break;

                case 'ice_candidate':
                    console.log("📡 Ağ Bilgisi (ICE Candidate) transfer ediliyor...");
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

    // Cihazlardan biri bağlantıyı kapattığında temizlik yapıyoruz
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
