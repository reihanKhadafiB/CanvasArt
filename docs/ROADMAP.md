# CanvasArt — roadmap pembangunan

Roadmap ini mengurutkan pekerjaan menuju produk lengkap. Tahapan bukan versi terbatas; seluruh fitur di [FEATURES.md](FEATURES.md) tetap menjadi target. Keputusan arsitektur dan model dokumen ada di [BLUEPRINT.md](BLUEPRINT.md).

## Status implementasi (28 Oktober 2026)

Repo dan shell editor sudah dibuat di CanvasArt dengan React, TypeScript, Vite, Fabric.js, dan JSZip. Jalur dasar yang telah terhubung: teks dan tipografi dasar, preset teks Default/Thin/Keep Calm/Meme/3D/3D Text/Old Text/New Text, meme yang menyesuaikan ukuran kanvas, gradasi teks linear/radial, tekstur gambar berulang untuk isi teks, teks melengkung, bayangan teks dengan warna/blur/offset dan glow, impor font TTF/OTF yang disimpan bersama autosave/proyek, 24 stiker SVG orisinal yang dapat dicari, difilter, dan difavoritkan secara lokal serta pustaka emoji teks, bentuk geometri dasar dan panah dengan fill gradien linear/radial atau tekstur gambar lokal serta bayangan luar/glow, impor gambar, crop gambar nondestruktif, ganti sumber gambar dengan mempertahankan transformasi, filter gambar per layer, penghapus kuas manual per gambar dengan Undo, gambar kuas dengan smoothing/simplifikasi dan garis putus-putus, path Bezier dengan handle kurva saat menggambar, preview kurva, dan edit anchor/handle setelah path dibuat; titik kontrol disimpan dalam objek proyek, transformasi dasar, daftar layer dengan rename/lock/hide/duplicate/delete/reorder, centang beberapa layer, hapus massal, grouping/ungrouping, align/distribute, gabung raster dengan undo, grid/snap dasar, zoom tombol, Ctrl+wheel, pinch dua jari, pan Space+drag/tombol tengah mouse dan fit-to-view, latar solid/transparan/gradien/gambar, preset ukuran kanvas, undo/redo snapshot termasuk ukuran dan efek, autosave IndexedDB + recovery, arsip `.canvasart` sederhana, ekspor PNG/JPEG dengan skala, dimensi kustom yang memperbarui preview dan pilihan pertahankan proporsi/regang, serta berbagi melalui Web Share API dengan fallback unduh, kutipan statis, efek global brightness/contrast/saturation/hue/vignette/noise/stripes, serta chroma key dasar untuk gambar raster. Rotasi teks X/Y kini memiliki simulasi ortografik dengan pemendekan sumbu dan disimpan sebagai transformasi objek. Ekstrusi teks 3D dapat diatur kedalaman, sudut, warna, penggelapan sisi, mode oblique/perspektif semu, dan simulasi cahaya arah/intensitas/ambient melalui glyph 2D bertumpuk. Mask objek nondestruktif mendukung elips/persegi dengan mode In/Out dan skala lebar/tinggi, serta path Bezier kustom dengan mode In/Out; path sumber disembunyikan saat dipakai, perubahan bentuk/transformasinya disinkronkan ke mask, dan visibilitas awalnya dipulihkan saat mask dilepas atau diganti. Warp perspektif empat titik berbasis mesh raster tersedia untuk teks, gambar, dan objek; sumber disimpan tersembunyi agar dapat dipulihkan, sedangkan warp non-destruktif yang mempertahankan edit vektor masih belum tersedia. Emboss teks menyediakan sudut cahaya, intensitas, ambient light, specular hardness, dan bevel. Inner Shadow teks menyediakan warna, blur, offset dan opacity. Reflection teks dapat diatur jarak, panjang, dan opacity. 3D Shadow teks memiliki kontrol arah, panjang, jarak, blur, warna, dan opacity; perspektif kamera penuh dan simulasi material masih belum tersedia.

Ini adalah fondasi berjalan, bukan aplikasi lengkap. Banyak kontrol yang tercatat di FEATURES.md belum dibuat. Lisensi, katalog aset berlisensi, adapter renderer, dan publikasi GitHub juga belum diselesaikan. Jalankan `npm run build` untuk memeriksa kompilasi; build saat ini berhasil, dengan peringatan bundle utama di atas 500 kB.

Panah kini menyimpan panjang, tebal batang, bentuk kepala, dan bentuk ekor sebagai properti proyek; semua properti tersebut dapat diubah lagi pada panah terpilih melalui inspector.

Gaya teks buatan pengguna kini dapat disimpan, diterapkan, dan dihapus; datanya tersimpan di localStorage serta metadata autosave/arsip proyek. Mode pratinjau layar penuh kini menyembunyikan kontrol editor dan mendukung Escape untuk keluar. Latar kanvas kini memiliki gradien linear/radial dengan dua warna yang dapat diatur. Transformasi objek menyediakan pemosisian relatif 3×3 terhadap kanvas. Pustaka kutipan 42 teks orisinal CanvasArt menyediakan kategori, bahasa, pencarian, dan favorit lokal. Dialog ekspor menampilkan preview render aktual dan memperbaruinya saat format/skala ekspor berubah.

## Tahap 0 — Kunci produk dan siapkan repo

### Pekerjaan

- Gunakan nama kerja CanvasArt; catat bahwa repo/merek belum diverifikasi.
- Putuskan lisensi kode, aturan kontribusi, kebijakan aset dan dependency.
- Tetapkan browser desktop minimum dan kebijakan aksesibilitas.
- Buat struktur React + TypeScript + Vite; gunakan Node 22 LTS dan catat versi melalui `.nvmrc`/`engines`.
- Siapkan README: tujuan, screenshot placeholder, langkah localhost, build, lisensi, status proyek, kontribusi.
- Buat wireframe desktop untuk toolbar, canvas workspace, lima tab, layer panel, menu/dialog.
- Tetapkan koordinat kanvas, transform convention, urutan layer/efek, command/action contract, schema v1.

### Hasil tahap

- Repo dapat di-clone dan dev server dapat dijalankan dengan instruksi terdokumentasi.
- Keputusan awal tercatat; nama, lisensi, aset, serta dukungan browser tidak disamarkan sebagai final bila belum diputuskan.

## Tahap 1 — Spike renderer dan validasi risiko teknis

### Pekerjaan

- Buat canvas uji kecil dengan `fabric` di belakang renderer adapter.
- Buktikan teks/font, gambar, bentuk, gradien/tekstur, seleksi, transform, layer order, zoom/pan.
- Buktikan serialization round-trip model dokumen, export PNG/JPEG pada ukuran berbeda, dan font impor.
- Coba satu implementasi proof-of-concept untuk perspektif/warp, mask, dan efek khusus; ukur biaya integrasi, bukan mengejar polish.
- Catat perilaku Fabric, browser API yang dipakai, limitasi, serta keputusan keep/replace/hybrid.

### Hasil tahap

- Catatan spike berisi demonstrasi alur inti dan keputusan renderer berdasarkan bukti.
- Arsitektur custom effects diputuskan sebelum banyak fitur dibangun di atas asumsi yang keliru.

## Tahap 2 — Document core, proyek dan sejarah edit

### Pekerjaan

- Implementasikan tipe Project, Canvas, Layer, Asset, dan objek dasar framework-independent.
- Serializer schema v1, validator, migrasi, format ZIP, manifest, asset IDs, validasi berkas saat import.
- Implementasikan command/action dan undo/redo; merge, crop dan transform harus dapat dipulihkan.
- IndexedDB autosave, status saved/unsaved, recovery dialog, hapus/restore snapshot.
- Jalur open/save proyek melalui upload dan download browser.

### Hasil tahap

- Dokumen kosong dan objek dasar dapat disimpan, dimuat ulang, diekspor sebagai proyek, dan dipulihkan setelah reload.
- Import proyek yang invalid menghasilkan pesan jelas dan tidak merusak autosave lain.

## Tahap 3 — Shell editor dan komposisi dasar

### Pekerjaan

- Toolbar atas, kanvas kerja, lima tab, layer panel, dialog dan menu.
- Pan/zoom sampai 500%, fit-to-screen, full-screen preview, seleksi dan transform handles.
- Tambah objek teks, gambar, bentuk; hapus, duplikasi, rename, lock/hide, reorder.
- Latar warna/gradien/transparan/gambar dan ukuran kustom/preset.
- Grid, snap-to-grid, guides tengah/tepi dan indikator jarak.
- Workspace desktop-first responsif; panel bisa collapse/resize.

### Hasil tahap

- Alur edit desain multi-layer dasar dapat dilakukan dari UI, bukan hanya lewat data/model.
- Tindakan toolbar, pointer, shortcut dan panel mengubah dokumen melalui satu action layer.

## Tahap 4 — Toolkit teks lengkap

### Pekerjaan

- Edit teks, ukuran, font katalog berlisensi, impor TTF/OTF, gaya B/I/U, warna parsial bila didukung model.
- Fill solid/gradient/texture, opacity, padding, background dan corner radius.
- Alignment, letter/word/line spacing, position presisi dan relative positioning.
- Curve text, stroke, shadow/glow, inner shadow, emboss, mask In/Out.
- Perspective empat titik, 3D rotation X/Y/Z, extrusion perspective/oblique, depth/color/darken/light, 3D shadow, reflection.
- Save/browse text styles dan preview efek.

### Hasil tahap

- Semua properti teks dapat diedit, diserialisasi, dipulihkan melalui undo/redo, dan dirender saat ekspor.

## Tahap 5 — Objek, gambar, drawing dan bentuk kustom

### Pekerjaan

- Shapes geometri, outline/stroke, opacity, gradient/texture.
- Stiker, emoji, badge, arrow dengan kontrol kepala/ekor/ukuran.
- Draw tool: brush size/color/smooth/dashed; hasil menjadi objek dapat dipindah/diubah.
- Bezier path dengan anchor, handles, edit ulang, fill/stroke.
- Import/crop/reselect gambar; filter hue/saturation/brightness/contrast.
- Manual eraser dan chroma key dengan tolerance/smooth edge.
- Mask, 3D semu, rotasi, shadow, inner shadow dan emboss pada tipe objek yang sesuai.

### Hasil tahap

- Semua tipe objek utama bisa dibuat, diedit, dikelola sebagai layer, disimpan, dimuat ulang dan diekspor.

## Tahap 6 — Layer lanjutan dan transformasi

### Pekerjaan

- Multi-select, group/ungroup, align/distribute, reorder granular, merge, bulk delete.
- Panel property adaptif menurut tipe dan jumlah seleksi.
- Warp dan perspektif untuk teks/gambar; kontrol empat titik dan preview.
- Mask vektor dan clipping; crop/resize dengan peringatan perubahan konten.
- Lengkapi guidelines, snapping antarobjek, keyboard nudge dan transform numerik.

### Hasil tahap

- Komposisi kompleks dapat diatur presisi dan tindakan destruktif dapat dibatalkan.

## Tahap 7 — Preset, quotes, aset dan efek global

### Pekerjaan

- Preset Default, Thin, Keep Calm, Meme, 3D, 3D Text, Old Text, New Text.
- Meme generator teks atas/bawah.
- Quotes per kategori dan bahasa; search/favorite; provenance/lisensi setiap kutipan.
- Cari/favorit font, sticker, preset; simpan gaya, palet warna, gradien dan efek pengguna.
- Pustaka latar/stiker/font bawaan dengan manifest lisensi dan atribusi.
- Canvas effects: rotate, vignette, noise, stripes, brightness, contrast, hue, saturation.

### Hasil tahap

- Semua tab punya alur lengkap dan konten bawaan dapat dikelola tanpa mengunci fungsi editor inti.

## Tahap 8 — Export, portabilitas dan browser integration

### Pekerjaan

- Export renderer output-resolution untuk PNG alpha dan JPEG.
- Preset Low/Medium/High/Very High/Ultra, dimensi custom, kualitas JPEG, preview, nama file.
- Share API bila tersedia dengan download fallback; file import drag/drop dan picker.
- Ekstensi arsip CanvasArt, format spec, asset handling, migration dan compatibility policy.
- Kamera/Web Share/File System Access hanya enhancement dengan fallback.
- Uji keterbatasan memori dan batas output; tampilkan validasi/progress/cancel bila memungkinkan.

### Hasil tahap

- Hasil ekspor sesuai ukuran/format dan file proyek portabel lintas browser yang didukung.

## Tahap 9 — Polishing, dokumentasi dan rilis open source

### Pekerjaan

- Pintasan keyboard lengkap, tema terang/gelap, lokalisasi, navigasi keyboard, label aksesibel.
- Worker untuk operasi yang berat; optimasi cache, render dan asset lifetime.
- Help/tutorial, About, attribution, feedback link, peringatan perubahan belum tersimpan.
- Dokumentasi pengguna, arsitektur, format proyek, aset dan kontribusi.
- Tentukan build lokal dan opsional workflow deploy statis ke GitHub Pages.
- Audit dependency/assets, kunci versi runtime, dan siapkan release checklist.

### Hasil tahap

- Seluruh checklist FEATURES.md selesai, aplikasi bisa dibangun dari clone GitHub, dokumentasi dan lisensi lengkap, dan workflow kontribusi siap dipakai.

## Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Fabric tidak mendukung efek 3D/warp/mask yang diperlukan | Renderer adapter; spike di Tahap 1; custom 2D/WebGL untuk efek spesifik |
| Canvas besar menghabiskan memori browser | Render bertahap, cache terukur, batas berbasis browser, pesan/progress dan fallback |
| Preview berbeda dari hasil ekspor | Aturan render bersama dan validasi untuk setiap jenis objek/efek |
| Autosave lokal hilang saat data browser dibersihkan | Ekspor proyek permanen, status autosave, recovery dan peringatan penyimpanan lokal |
| Lisensi aset/font tidak jelas | Manifest lisensi, audit sebelum bundling, aset buatan sendiri/open license |
| API file/kamera/share beda antar-browser | File input/download sebagai jalur dasar; API modern opsional dengan fallback |
| Perubahan format memutus proyek lama | Schema version, migrasi, fixture proyek lama dan format terdokumentasi |

## Prinsip urutan kerja

- Jangan menunda model dokumen, aksi undo/redo dan penyimpanan sampai setelah UI penuh dibuat.
- Tutup risiko renderer sebelum berinvestasi besar pada efek lanjutan.
- Implementasikan setiap fitur melalui model → action → preview → persistence → export → UI controls.
- Tiap tahap punya hasil yang bisa ditinjau; tidak ada klaim bahwa fitur lengkap sebelum checklist terkait terpenuhi.

