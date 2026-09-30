# 📹 WebRTC Canlı Kamera & İzleme İstasyonu

Eski bir telefonu güvenlik/bebek kamerasına, başka bir telefonu veya bilgisayarı ise canlı izleme ekranına dönüştüren WebRTC tabanlı yerel yayın uygulaması.

---

## 🚀 Başka Bir Bilgisayarda Nasıl Çalıştırılır?

Bu projeyi herhangi bir bilgisayarda (Windows, Mac, Linux) çalıştırmak için sadece 2 adım yeterlidir:

### 1. Gereksinim
Bilgisayarda [Node.js](https://nodejs.org/) kurulu olmalıdır.

### 2. Kurulum ve Başlatma
Terminali (veya Komut İstemini) proje klasöründe açın ve şu iki komutu çalıştırın:

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Sunucuyu başlatın
npm start
```

> **Not:** Telefonların kameraya erişebilmesi için HTTPS zorunludur. Proje ilk kez başlatıldığında gerekli SSL sertifikasını (`cert.pem`, `key.pem`) **otomatik olarak üretir**, harici hiçbir ayar yapmanıza gerek kalmaz.

---

## 📱 Kullanım (Aynı Wi-Fi Ağında)

1. Bilgisayarınızın ekranında çıkan kontrol panelini açın:
   - `https://localhost:3000`
2. **Eski Telefon (Kamera):**
   - Bilgisayarla aynı Wi-Fi ağına bağlı olduğundan emin olun.
   - Ekrandaki **Kamera QR Kodunu** okutun (veya ekranda yazan `https://<BİLGİSAYAR_IP>:3000/camera.html` adresine girin).
   - Çıkan yerel sertifika uyarısında: **Gelişmiş -> Siteye ilerle** deyin ve kamera iznini onaylayın.
3. **Yeni Telefon (İzleyici):**
   - Ekrandaki **İzleyici QR Kodunu** okutun.
   - Canlı görüntü yeşil çerçeveyle anında başlar!

---

## ✨ Özellikler
- 🔄 **Kamerayı Çevir:** Eski telefonda tek tuşla ön veya arka kameraya geçiş.
- 🎙️ **Mikrofon & Ses Kontrolü:** Kamerada mikrofonu açıp kapatma, izleyicide sesi açıp kapatma.
- ⛶ **Tam Ekran:** İzleme ekranında tek dokunuşla tam ekran modu.
- 📲 **QR Kodlu Kontrol Paneli:** IP adresi yazmaya gerek kalmadan telefon kamerasıyla anında bağlanma.
- 🔒 **Otomatik SSL:** Ekstra araç kurmadan yerel HTTPS desteği.
