# Remote Desktop Local

Aplikasi remote desktop lokal menggunakan Node.js dan WebRTC untuk Mac Air M1 ARM processor.

## Fitur

✅ **WebRTC Screen Sharing** - Streaming layar real-time tanpa kompresi berat  
✅ **Mouse & Keyboard Control** - Kontrol presisi mouse dan keyboard  
✅ **Local Network Access** - Dapat diakses dari semua device dalam jaringan lokal  
✅ **Efficient & Lightweight** - Optimized untuk device dengan resource terbatas  
✅ **Client/Host Mode** - Flexible sebagai pengontrol atau yang dikontrol  
✅ **Real-time Stats** - Monitor FPS dan latency  

## Prerequisites

- Node.js (versi 16+)
- Mac Air M1 atau device ARM lainnya
- Browser modern dengan dukungan WebRTC
- Device dalam satu jaringan lokal

## Instalasi

1. **Install dependencies:**
```bash
npm install
```

2. **Start server:**
```bash
npm start
```

3. **Server akan berjalan di:**
- Local: `http://localhost:3000`
- Network: `http://[IP-ADDRESS]:3000`

## Cara Penggunaan

### Setup Host (Device yang akan dikontrol)

1. Buka browser dan akses aplikasi
2. Klik tombol **"Host"** di sidebar
3. Browser akan meminta permission untuk screen sharing - klik **"Allow"**
4. Status akan berubah menjadi **"Screen Sharing"**
5. Catat **ID** yang muncul di sidebar

### Setup Client (Device pengontrol)

1. Buka browser dari device lain dalam jaringan yang sama
2. Akses aplikasi menggunakan Network URL
3. Klik tombol **"Client"** di sidebar (default)
4. Koneksi akan otomatis terhubung ke Host yang tersedia

### Kontrol Remote

**Mouse:**
- Move: Gerakkan mouse di area layar
- Click: Klik kiri/kanan/tengah
- Scroll: Gunakan scroll wheel

**Keyboard:**
- Type: Ketik langsung (fokus harus di area layar)
- Shortcuts: Ctrl, Shift, Alt, Cmd combinations

**Fullscreen:**
- Klik tombol "Fullscreen" untuk mode layar penuh

## Tips Optimasi

- **Resolusi Host**: Gunakan resolusi rendah untuk performa lebih baik
- **Network**: Pastikan koneksi WiFi stabil
- **Browser**: Gunakan Chrome/Safari untuk kompatibilitas terbaik
- **Resource**: Tutup aplikasi lain untuk performa optimal

## Troubleshooting

**Screen sharing tidak muncul:**
- Pastikan browser mendukung `getDisplayMedia()`
- Check permission screen recording di System Preferences (Mac)

**Mouse/keyboard tidak bekerja:**
- Install RobotJS dependencies: `npm rebuild`
- Berikan permission Accessibility di System Preferences

**Koneksi terputus:**
- Check firewall settings
- Pastikan port 3000 tidak diblock

## Network Configuration

Server secara otomatis mendeteksi IP address lokal. Untuk akses dari device lain:

1. Cek IP address host di terminal saat server start
2. Buka `http://[IP-ADDRESS]:3000` di device client
3. Pastikan semua device dalam subnet yang sama

## Development

```bash
# Development mode dengan auto-reload
npm run dev

# Install dependencies untuk ARM Mac
npm install --target_arch=arm64
```

## Security Note

Aplikasi ini didesain untuk penggunaan dalam jaringan lokal saja. Tidak menggunakan enkripsi atau autentikasi untuk menjaga performa optimal.

## License

MIT License 