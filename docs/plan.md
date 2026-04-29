# Rencana Pengembangan: Sistem Scoring Artikel Otomatis

Rencana ini bertujuan untuk menambahkan lapisan kualitas pada konten yang dihasilkan AI sebelum dipublikasikan ke WordPress.

## Target Fitur
1. **AI Evaluator**: Menggunakan model Gemini untuk menilai artikel yang baru dihasilkan.
2. **Quality Gate**: Hanya artikel dengan skor **> 95** yang akan otomatis di-post.
3. **Detail Scoring**: Penilaian mencakup SEO, alur logika, dan gaya bahasa.

## Alur Kerja Baru (dengan Regenerasi)
1. **Generate**: Artikel dibuat menggunakan `generateArticle`.
2. **Evaluate**: Artikel dinilai oleh Gemini (`evaluateArticle`) untuk mendapatkan skor.
3. **Decision Loop**:
   - Jika **Skor > 95**: Lanjut ke proses Upload Gambar dan Post.
   - Jika **Skor <= 95** dan **Belum mencapai batas retry (max 3x)**: Ulangi langkah 1 (Generate ulang).
   - Jika **Sudah 3x mencoba** dan skor tetap rendah: Log kegagalan dan lewati artikel tersebut.

## Estimasi Perubahan Kode
### `utils/gemini.js`
- Tambahkan fungsi `evaluateArticle(title, content)`.
- Prompt harus menginstruksikan AI untuk memberikan skor dalam format JSON yang mudah di-parse.

### `tests/wordpress-bulk-img.spec.js`
- Tambahkan langkah pengecekan skor setelah tahap `generateArticle`.
- Gunakan `test.skip()` jika skor tidak memenuhi kriteria.

## Kriteria Penilaian AI
- **SEO Score**: Penggunaan kata kunci, heading, dan meta description.
- **Readability**: Kelancaran kalimat dan kemudahan dipahami.
- **Relevance**: Seberapa baik isi artikel menjawab judul yang diberikan.
