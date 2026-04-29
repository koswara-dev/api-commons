# WordPress API Testing with Playwright

Proyek ini menyediakan kerangka kerja untuk melakukan pengujian otomatis pada WordPress REST API menggunakan **Node.js** dan **Playwright**. Proyek ini mencakup penyiapan lingkungan lokal menggunakan Docker Compose.

## Fitur
- **Otentikasi**: Menggunakan *Application Passwords* WordPress (Basic Auth).
- **Manajemen Konten**: Pengujian pembuatan artikel (*Post*) baru secara otomatis.
- **Dockerized**: Dilengkapi dengan `docker-compose.yml` untuk menjalankan WordPress dan MariaDB versi terbaru secara instan.
- **Resilient**: Script pengujian mendukung baik format URL REST API standar (`/wp-json/`) maupun format kompatibilitas (`?rest_route=`).

## Prasyarat
- [Node.js](https://nodejs.org/) (v16+)
- [Docker](https://www.docker.com/) & Docker Compose

## Persiapan Lingkungan

### 1. Jalankan WordPress (Docker)
```bash
docker-compose up -d
```
Akses WordPress di: `http://localhost:8080` (atau via domain ngrok jika dikonfigurasi).

### 2. Selesaikan Instalasi WordPress
Buka WordPress di browser dan selesaikan langkah instalasi awal (pilih bahasa, buat user admin, dll).

### 3. Buat Application Password
1. Masuk ke dashboard Admin WordPress.
2. Pergi ke menu **Users > Profile**.
3. Cari bagian **Application Passwords**.
4. Beri nama aplikasi (misal: "Playwright API"), lalu klik **Add New**.
5. Salin kode password yang muncul (contoh: `abcd efgh ijkl mnop`).

### 4. Konfigurasi .env
Buat file `.env` di root direktori:
```env
WP_URL=http://localhost:8080
WP_USERNAME=admin
WP_APP_PASSWORD=abcd efgh ijkl mnop
```

## Menjalankan Pengujian

Instal dependencies terlebih dahulu:
```bash
npm install
```

Jalankan test:
```bash
npm test
```

Lihat laporan pengujian (Playwright Report):
```bash
npx playwright show-report
```

## Struktur Proyek
- `tests/`: Berisi file spesifikasi pengujian Playwright.
- `playwright.config.js`: Konfigurasi utama Playwright.
- `docker-compose.yml`: Definisi layanan WordPress & MariaDB.
- `.env`: Variabel lingkungan untuk kredensial (jangan di-commit).

## Lisensi
ISC
