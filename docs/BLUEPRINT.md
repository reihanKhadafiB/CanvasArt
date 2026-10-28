# CanvasArt — blueprint

Daftar fitur rinci dan checklist implementasi ada di [FEATURES.md](FEATURES.md). Roadmap tahap demi tahap ada di [ROADMAP.md](ROADMAP.md). Ketiga dokumen ini bersama-sama menjadi acuan produk.

## 1. Ringkasan produk

**CanvasArt** adalah editor desain grafis open source berbasis web. Pengguna menjalankannya di komputer sendiri melalui `localhost`, mengedit desain secara lokal, lalu menyimpan proyek atau mengekspor gambar. Source code akan tersedia di GitHub.

Targetnya adalah kemampuan lengkap yang tercatat dalam FEATURES.md: editor teks dan efek 3D semu, objek gambar/bentuk, tool gambar, layer, kanvas, preset, proyek, dan ekspor. Roadmap membagi pekerjaan berdasarkan ketergantungan teknis; pembagian itu tidak mengurangi cakupan produk.

## 2. Keputusan produk yang sudah disepakati

- Nama kerja: **CanvasArt**. Pemeriksaan nama repo dan merek belum menjadi klaim final.
- Bentuk produk: aplikasi web desktop-first yang dijalankan di localhost.
- Source: proyek open source di GitHub.
- Backend: tidak dibutuhkan untuk fungsi editor inti.
- Penyimpanan: autosave lokal browser dan file proyek yang dapat diunduh/diunggah.
- Kecerdasan buatan: tidak ada. Penghapusan latar menggunakan kuas manual dan chroma key.
- Identitas, kode, UI, font/stiker/latar/kutipan yang didistribusikan dibuat sendiri atau memiliki lisensi redistribusi yang jelas. Jangan menyalin merek/aset/UI PixelLab.
- Format proyek: format CanvasArt sendiri; jangan menjanjikan kompatibilitas `.plp` PixelLab.

## 3. Stack yang disarankan

- **React + TypeScript + Vite**: antarmuka, komponen editor, dan dev server/build statis.
- **Node.js 22 LTS**: runtime development/build/CI, dipatok melalui `.nvmrc`; Vite mensyaratkan Node.js 20.19+ atau 22.12+.
- **Fabric.js (`fabric`) sebagai kandidat renderer**: scene graph, seleksi, objek, transformasi, dan alur dasar. Bukan sumber kebenaran dokumen; integrasikan melalui adapter agar dapat diganti.
- **Canvas 2D / `Path2D`**: path Bezier, mask, dan rendering khusus yang tidak disediakan engine.
- **WebGL shader bila perlu**: warp/perspektif, efek piksel, dan akselerasi filter yang memang terbukti perlu.
- **Web Workers / `OffscreenCanvas` secara progresif**: proses gambar berat; sediakan fallback main thread untuk dukungan browser yang tidak lengkap.
- **IndexedDB**: autosave dan preferensi lokal.
- **Arsip ZIP + JSON**: format proyek portabel; ZIP menyimpan manifest berversi dan media proyek.
- **File input/download sebagai jalur standar**. File System Access API, kamera, dan Web Share API adalah peningkatan opsional karena dukungan/izin browser berbeda.

Renderer dan format proyek sengaja dipisahkan. Fabric mempercepat interaksi dasar, sedangkan beberapa kebutuhan—warp, perspektif sudut bebas, mask kurva, inner shadow/emboss presisi, ekstrusi 3D, efek global—akan memerlukan renderer kustom. Bentuk 3D ditargetkan sebagai ekstrusi/perspektif semu 2D; scene 3D penuh tidak diperlukan kecuali hasil uji membuktikan ada kebutuhan.

## 4. Batas aplikasi

### Termasuk

- Semua fitur yang dicatat dalam [FEATURES.md](FEATURES.md), termasuk toolbar dan lima tab.
- Editor offline/local-first setelah aplikasi berhasil dimuat; tidak ada akun atau sinkronisasi wajib.
- Arsip proyek mandiri yang membawa dokumen dan aset lokalnya.
- Build development untuk localhost; hosting statis seperti GitHub Pages boleh disediakan kemudian.

### Tidak termasuk dalam cakupan sekarang

- Aplikasi mobile native.
- Akun pengguna, server penyimpanan, sinkronisasi cloud, atau kolaborasi realtime.
- Fitur AI.
- Mengklaim membuka/menulis format `.plp` PixelLab tanpa dukungan yang sah dan terverifikasi.
- Menyalin kode, ikon, tata letak, aset, atau identitas PixelLab.

## 5. Arsitektur logis

```text
React UI
  ├── Toolbar, lima tab, layer panel, dialogs, shortcuts
  └── Property panels (berdasarkan tipe dan seleksi)
             │ intent/actions
Editor application layer
  ├── Selection, tools, keyboard/pointer controller
  ├── Undo/redo command history
  ├── Autosave/recovery coordinator
  └── Import/export coordinator
             │ document state
Document core (framework-independent TypeScript)
  ├── Project, page/canvas, layers, typed objects, assets
  ├── Geometry, transforms, fills, masks, effects
  ├── Serializer + schema migrations
  └── Validation and asset references
       ├── Interactive renderer adapter (Fabric + custom Canvas/WebGL)
       ├── Export renderer (same visual rules, output resolution)
       └── Persistence (IndexedDB + ZIP file)
Browser adapters: local files, download, optional camera/share/clipboard
```

### Aturan arsitektur

- **Model dokumen adalah sumber kebenaran.** Jangan menyimpan satu-satunya salinan properti di state widget atau objek internal Fabric.
- **Aksi dokumen terpusat.** Perubahan dari toolbar, shortcut, drag, dan panel properti harus menghasilkan command/action yang sama agar undo/redo konsisten.
- **Preview dan export berbagi aturan render.** Boleh memakai target berbeda, tetapi properti dan urutan efek harus konsisten.
- **Efek non-destruktif jika memungkinkan.** Simpan parameter efek; rasterisasi hanya untuk merge, hasil kuas, atau proses yang memang perlu.
- **Aset mempunyai ID stabil.** Referensi dalam dokumen tidak bergantung pada path lokal asli pengguna.
- **Versi skema eksplisit.** Setiap proyek memiliki versi dan migrasi; proyek rusak/fitur tak dikenal dilaporkan, bukan diam-diam dibuang.

## 6. Model dokumen konseptual

- `Project`: schemaVersion, metadata, kanvas, background, efek global, layers, asset manifest, preset/font references.
- `Canvas`: width, height, unit px, background, safe bounds bila kelak diperlukan.
- `Layer`: id, name, visible, locked, opacity, z-order, objek atau grup.
- `Object`: id, type, transform, opacity, blend mode, fill, stroke, mask, efek, metadata seleksi.
- Jenis objek: text, image, shape, arrow, bezier/path, freehand drawing, sticker.
- `TextObject`: teks/segmen bergaya, font id, ukuran, alignment, spacing, background, curve, dan text effects.
- `ImageObject`: asset id, crop, filters, chroma-key settings dan mask/eraser data.
- `Asset`: gambar/font/stiker/tekstur dengan media type, data, ukuran, attribution/license metadata bila asset bawaan.
- `GlobalEffects`: urutan efek kanvas, parameter, status enabled.
- Semua koordinat dokumen memakai piksel kanvas independen dari zoom UI.

## 7. Alur workspace

- **Toolbar atas:** tambah, project save/open, ekspor/share, kutipan, menu, undo/redo, zoom, grid/snap, layer panel.
- **Kanvas tengah:** ruang kerja dengan pan/zoom, seleksi, handles, guides dan snap.
- **Lima tab properti:** Presets, Text, Objects/Shapes, Background/Canvas, Canvas Effects.
- **Layer panel:** daftar, seleksi, lock/hide, duplicate/delete, urutan, multi-select, merge.
- Layout desktop-first: kanvas mendapat ruang utama; panel bisa disembunyikan/diubah ukuran. Jendela sempit memakai panel/tab yang dapat dilipat.
- Properti kontekstual: hanya tampilkan kontrol yang relevan untuk objek terpilih; nilai numerik tetap tersedia untuk kerja presisi.

## 8. Penyimpanan dan portabilitas

- Autosave terjadwal dan setelah operasi penting ke IndexedDB.
- Pemulihan menampilkan daftar autosave/proyek lokal, waktu simpan dan pilihan restore/delete.
- File proyek CanvasArt berupa arsip ZIP: manifest JSON, aset, preview opsional, metadata dan versi skema.
- Nama ekstensi ditetapkan ketika identitas proyek/repo dikunci; hindari `.plp` untuk mencegah kesan kompatibilitas PixelLab.
- Buka/simpan tetap berfungsi dengan input file dan download browser; API file langsung hanya enhancement.
- Dokumentasikan format supaya file dapat dibaca tool pihak ketiga.

## 9. Ekspor

- PNG dengan alpha dan JPEG dengan latar opak.
- Output dirender pada ukuran target, bukan screenshot tampilan editor.
- Preset kualitas dan dimensi custom; clamp/beri peringatan untuk dimensi yang melebihi memori browser.
- Dialog pratinjau, format, dimensi, kualitas, nama file dan ukuran perkiraan.
- Share API jika tersedia; download sebagai fallback universal.

## 10. Kualitas, privasi dan aksesibilitas

- Aset pengguna diproses lokal secara default; jangan kirim ke jaringan.
- Aplikasi menjelaskan bahwa autosave browser bukan pengganti file proyek yang diunduh.
- Shortcut tidak boleh mengganggu input teks; semua kontrol utama punya label dan navigasi keyboard.
- Tema terang/gelap, indikator status simpan, progres untuk proses berat, dan pesan error yang dapat ditindaklanjuti.
- Batas ukuran kanvas ditentukan melalui pengukuran pada browser target; hindari angka maksimum universal yang tak dapat dijamin.
- Lisensi aplikasi, lisensi dependency dan lisensi konten aset didokumentasikan terpisah.

## 11. Keputusan yang masih terbuka

1. Lisensi source code: rekomendasi MIT untuk kontribusi/reuse paling sederhana; pilih copyleft jika ingin perubahan turunan juga tetap dibuka.
2. Nama repo/handle dan pemeriksaan merek untuk CanvasArt.
3. Browser dan versi minimum yang akan dijanjikan.
4. Batas maksimum kanvas dan fallback saat batas memori terlampaui.
5. Daftar aset bawaan, jumlah awal, lisensi, dan atribusinya.
6. Ekstensi final arsip proyek CanvasArt.
7. Hasil spike renderer untuk teks, fill, seleksi, export, efek custom dan performa.

