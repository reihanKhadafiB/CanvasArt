# Spesifikasi fitur lengkap

Dokumen ini adalah daftar kebutuhan fitur aplikasi editor web open source yang berjalan di localhost. Ini mencatat seluruh fitur yang pengguna minta agar menjadi acuan implementasi dan tidak ada yang terlupakan.

Nama kerja aplikasi: **CanvasArt**.

## Prinsip produk

- Aplikasi berjalan lokal di browser dan source tersedia di GitHub.
- Tidak membutuhkan akun, server aplikasi, atau koneksi cloud untuk mengedit.
- Tidak ada fitur berbasis AI.
- Penghapusan latar dilakukan dengan erase manual atau chroma key.
- Nama, logo, aset, dan desain antarmuka dibuat sendiri; produk rujukan hanya menjadi acuan kemampuan.
- File proyek memiliki format terbuka dan versi skema. Ekstensi `.plp` milik PixelLab tidak berarti file buatan aplikasi otomatis kompatibel dengannya.

## A. Toolbar atas

### A1. Tambah (+)

- **Text:** menambah objek teks baru.
- **Current Date:** menambahkan tanggal saat ini sebagai teks.
- **Sticker:** membuka pustaka stiker, emoji, dan badge.
- **Shapes:** membuat bentuk geometri.
- **From Gallery / Import Image:** memilih gambar dari file lokal.
- **Draw:** masuk ke mode gambar manual.

### A2. Simpan dan ekspor

- **Save as Project:** mengunduh arsip proyek yang memuat dokumen dan asetnya.
- **Save as Image / Export Image:** merender hasil akhir ke PNG atau JPEG.
- Pilihan ukuran/resolusi: Default, Custom, Low, Medium, High, Very High, Ultra.
- PNG dapat mempertahankan transparansi; JPEG menggunakan latar tanpa alpha.
- Kualitas JPEG dapat diatur; PNG menampilkan ukuran keluaran dan opsi kompresi yang didukung browser.
- Preview hasil render sebenarnya sebelum file diunduh; preview mengikuti format, skala, dan efek global yang dipilih.

### A3. Bagikan

- Menghasilkan gambar ekspor lalu membuka browser share API bila tersedia.
- Sediakan fallback unduh file untuk browser yang tidak mendukung share API.

### A4. Kutipan

- Pustaka saat ini berisi 42 kutipan orisinal CanvasArt, tersebar di kategori Motivation, Success, Friendship, Happiness, Inspiration, Positivity, dan Absurd; tersedia dalam bahasa Indonesia dan Inggris.
- Bahasa/kategori dapat dipilih; kutipan dapat dicari dan difavoritkan secara lokal.
- Memilih kutipan menambahkannya sebagai objek teks yang bisa diedit.
- Isi kutipan ditulis khusus untuk CanvasArt; tidak memakai layanan eksternal atau kutipan pihak ketiga.

### A5. Menu lainnya (⋮)

- **Use image from Gallery:** menjadikan gambar lokal sebagai latar kanvas.
- **Full screen:** mode pratinjau menyembunyikan toolbar/panel sementara, memperbesar kanvas, dan dapat ditutup dengan Escape atau tombol keluar.
- **Use image from Camera:** opsional melalui API kamera browser jika izin dan perangkat mendukung; jika tidak, gunakan pemilih file.
- **Export Image:** akses alternatif ke dialog ekspor.
- **Image Size:** atur lebar/tinggi dan preset: Custom, Square, Profile Picture, YouTube Channel Banner, YouTube Thumbnail, Facebook Cover Art, Google Header Image, Twitter Header Size.
- **Tutorials / Help:** membuka panduan proyek sendiri.
- **Recover AutoSave:** menampilkan dan memulihkan autosave lokal.
- **Open Project:** mengimpor arsip proyek aplikasi.
- **About:** nama, versi, lisensi, kredit, dan tautan source.
- **Exit:** penutupan mengikuti browser; event beforeunload memperingatkan jika revisi dokumen belum selesai ditulis ke IndexedDB. Autosave yang selesai untuk revisi terbaru membersihkan status perubahan; autosave lama yang selesai setelah edit baru tidak menandai dokumen sebagai tersimpan.

### A6. Kontrol kerja cepat

- **Undo** dan **Redo:** membatalkan atau mengulangi tindakan dokumen.
- **Zoom/pan:** tombol zoom sampai 500%, Ctrl+wheel, dan pinch dua jari; titik di bawah kursor/pinch dipertahankan sebagai pusat zoom. Pan kanvas memakai Space+drag atau tombol tengah mouse. Pas ke layar menyesuaikan kanvas dengan area kerja.
- **Grid:** tampil/sembunyikan grid; opsi jarak grid.
- **Snap to Grid:** magnet untuk menempelkan objek ke titik/garis grid.
- **Layer Panel:** buka panel layer.

## B. Panel layer

- Daftar semua layer dengan nama, thumbnail bila tersedia, dan tipe objek.
- Pilih layer untuk fokus/select objek.
- **Lock/Unlock:** mencegah/mengizinkan transformasi objek.
- **Show/Hide:** tampilkan/sembunyikan objek tanpa menghapusnya.
- **Delete:** hapus layer terpilih.
- **Duplicate:** buat salinan objek/layer.
- **Rename:** ubah nama untuk memudahkan pengelolaan.
- **To Front / To Back** dan pengaturan urutan layer yang lebih granular.
- **Multi-select:** pilih beberapa layer sekaligus.
- **Bulk delete:** hapus semua layer terpilih.
- **Merge:** gabungkan layer terpilih menjadi satu hasil raster/objek; pertahankan sumber melalui undo.
- Toggle lock, visibility, delete, duplicate, serta kontrol edit layer dari daftar.

## C. Lima tab bawah / panel properti

### C1. Presets

- Preset awal: Default, Thin, Keep Calm, Meme, 3D, 3D Text, Old Text, New Text.
- Preset mengatur gaya awal desain/teks sesuai definisinya; seluruh objek hasil preset tetap dapat diedit.
- Meme membuat teks atas dan bawah yang bisa diedit.
- Browse dan favorit preset; simpan preset pengguna bila didukung.

### C2. Pengeditan teks (aktif untuk teks terpilih)

#### Operasi teks dan tata letak

- **Styles:** simpan, browse/terapkan, dan hapus gaya teks milik pengguna; gaya mencakup tipografi, fill warna solid, stroke, background teks, opacity, dekorasi, spacing, dan shadow. Disimpan di localStorage dan disertakan dalam autosave/arsip proyek.
- **Edit:** ubah isi teks.
- **Delete / Copy:** hapus atau duplikasi objek teks.
- **To Front / To Back:** ubah urutan layer.
- **Position:** geser dengan nilai presisi X/Y atau nudge per langkah.
- **Relative Position:** posisi 3×3 yang menempel pada sisi atau pusat kanvas, menghitung batas objek terotasi.
- **Size:** ubah ukuran teks/objek.
- **Padding:** left/right padding untuk mencegah glyph terpotong saat miring/ber-efek.
- **Opacity:** 0–100%; opsi mengaktifkan/menonaktifkan bayangan sesuai perilaku efek.
- **Rotate:** putar teks di bidang 2D.

#### Isi, font, dan paragraf

- **Color:** warna solid.
- **Gradient:** gradien linear dan radial, termasuk posisi/arah dan warna stop.
- **Partial text color:** memilih rentang karakter untuk warna/gradien berbeda bila diterapkan.
- **Texture:** isi glyph dengan gambar/tekstur lokal.
- **Font:** pustaka font bawaan yang lisensinya sesuai dan pencarian font.
- **My Fonts:** impor TTF/OTF lokal dan tampilkan font pengguna.
- **Style:** Bold, Italic, Underline, Strikethrough, dan reset/clear style. Bold/Italic quick toggles serta underline/strikethrough controls tersedia.
- **Curve:** lengkungkan teks ke atas/bawah dengan kontrol besar lengkung.
- **Background:** bidang latar teks dengan warna/fill, padding kiri/kanan/atas/bawah, dan corner radius.
- **Align:** kiri, tengah, kanan, justify.
- **Spacing:** letter spacing dan word spacing.
- **Line Spacing:** jarak antarbaris.

#### Efek teks

- **Stroke:** aktif/nonaktif, warna, lebar.
- **Shadow:** aktif/nonaktif, warna, blur radius, outer glow, offset X/Y.
- **Inner Shadow:** warna, blur, offset dan intensitas.
- **Emboss:** light angle, intensitas/cahaya, ambient light, specular hardness, bevel.
- **Mask:** mask berbasis kurva/path; mode In dan Out; edit anchor/handle.
- **Perspective:** warp empat sudut tersedia untuk teks, gambar, dan objek dengan kontrol koordinat setiap sudut. Hasil saat ini dirender sebagai mesh raster; objek sumber disimpan tersembunyi, tetap dapat dipulihkan dengan tombol lepas warp. Objek warp bisa diedit pada empat titik melalui panel angka.
- **3D Rotate:** rotasi sumbu X, Y, Z.
- **3D Text:** ekstrusi teks dengan mode Perspective dan Oblique; depth, depth color, darken, rotasi, serta simulasi cahaya pada sisi ekstrusi dengan kontrol arah, intensitas, dan ambient. Bentuknya tetap renderer 2D berlapis, bukan model 3D penuh.
- **3D Shadow:** bayangan lantai di bawah teks dengan arah, jarak, dan intensitas bila tersedia.
- **Reflection:** refleksi vertikal dengan jarak, opacity/fade, dan panjang refleksi.

### C3. Pengeditan objek dan bentuk

#### Alat membuat objek

- **Sticker, Import, Draw, Shapes:** akses yang sama dengan tombol tambah.
- **Bezier:** gambar path dengan anchor point dan handle kurva; edit titik setelah dibuat.
- **Arrow:** panah dapat dibuat dengan pilihan kepala lebar/sempit/tanpa kepala, ekor rata/takik, warna, panjang, dan tebal batang. Panah yang dipilih dapat mengubah panjang, tebal, model kepala, dan ekor lewat inspector; parameter geometri tersimpan di project.

#### Properti umum objek

- Copy, delete, z-order, position presisi, relative position, size, rotate, opacity.
- Warna/fill solid atau gradien, tekstur, stroke bila objek mendukung.
- Mask dan shadow tersedia untuk objek. Inner Shadow serta Emboss kini dapat diatur pada gambar, bentuk geometri (rect/circle/ellipse/triangle/polygon), dan path Bezier; renderer khususnya menonaktifkan object cache agar pratinjau dan ekspor memperbarui efek dengan benar. Grup dan tipe objek lain belum mendapat kontrol permukaan ini.

#### Kontrol khusus gambar

- **Crop:** atur area potong gambar.
- **Re-select:** ganti sumber gambar sambil mempertahankan transform dan efek objek.
- **Color Filter:** Hue, Saturation, Brightness, Contrast.
- **Eraser:** hapus bagian gambar secara manual dengan ukuran kuas, hardness/soft edge, undo.
- **Erase Color / Chroma Key:** pilih warna target, atur tolerance dan smooth edge; hasil warna terpilih menjadi transparan.

### C4. Latar dan kanvas

- **Color:** latar warna solid.
- **Gradient:** latar gradien linear/radial dengan warna awal dan akhir yang bisa dipilih.
- **Transparent:** latar alpha transparan dengan pola checkerboard hanya sebagai indikator UI.
- **Image Size:** dimensi kustom/preset yang sama dengan menu toolbar.
- **Crop:** crop latar gambar.
- **Image:** pustaka latar bawaan dengan lisensi jelas.
- **From Gallery:** gunakan file lokal sebagai latar.
- **From Camera:** gunakan kamera browser jika tersedia dan diizinkan.
- Perubahan ukuran kanvas mempertahankan atau menyesuaikan posisi konten sesuai pilihan pengguna.

### C5. Efek kanvas global

- **Rotate:** rotasi orientasi seluruh hasil.
- **Vignette:** tingkat, ukuran, softness dan warna jika tersedia.
- **Noise:** grain/noise dengan jumlah/intensitas.
- **Stripes:** scanlines/garis, orientasi, jarak dan opacity.
- **Brightness, Contrast, Hue, Saturation:** kontrol nilai dan reset.
- Efek global dapat dipreview dan disimpan dalam dokumen proyek.

## D. Fitur inti lintas panel

### Teks dan aset

- Banyak objek teks dalam satu desain.
- Lebih dari 100 font bawaan sebagai target katalog hanya jika font yang sesuai lisensi dapat dikurasi; mendukung font impor TTF/OTF.
- Pustaka lokal saat ini menyediakan 24 stiker ilustrasi SVG orisinal dalam kategori Badge, Dekorasi, Ekspresi, dan Simbol, dengan pencarian dan favorit tersimpan lokal; emoji teks sistem tetap tersedia di panel terpisah. Katalog ini belum mencapai target ratusan aset, sehingga penambahan aset orisinal masih menjadi pekerjaan.
- Bentuk geometri: persegi/persegi panjang, lingkaran/elips, segitiga, bintang dan bentuk dasar lain.
- Bentuk mendukung fill, opacity, stroke/outline dan lebar stroke.
- Gambar manual dengan kuas: ukuran, warna, smoothing kurva kuadratik dan simplifikasi titik, serta garis putus-putus; hasil gambar menjadi objek yang dapat diubah ukuran/rotasi.
- Impor foto/gambar dari file lokal untuk kolase/komposisi.

### Transformasi dan bantuan tata letak

- Transformasi objek dengan pointer/handles dan panel nilai numerik.
- Pilih banyak objek; group/ungroup.
- Align dan distribute; posisikan relatif terhadap kanvas.
- Grid, snap ke grid, guides tepi/tengah/objek, indikator jarak.
- Zoom maksimum 500%, pan canvas dan fit-to-screen.

### Proyek dan penyimpanan lokal

- Autosave berkala ke IndexedDB dan recovery saat aplikasi dibuka lagi.
- Undo/redo riwayat untuk edit properti, transform, import, delete, merge, dan pengaturan kanvas.
- Save project sebagai arsip portabel dengan JSON versi skema dan aset terbungkus.
- Open project melalui upload file dan validasi arsip.
- Format proyek terdokumentasi; migrasi skema saat format berubah.
- Buka file `.plp` PixelLab hanya jika formatnya berhasil didukung secara legal dan teruji; jangan mengklaim kompatibilitas sebaliknya.

### Ekspor

- PNG dan JPEG.
- PNG alpha transparan.
- Dimensi preset dan custom; kualitas Low, Medium, High, Very High, Ultra.
- Render berdasarkan resolusi output, bukan sekadar screenshot UI.
- Preview sebelum unduh; nama file dapat ditentukan.
- Bagikan hasil dengan Web Share API bila tersedia; fallback download.

## E. Definisi detail browser/localhost

- File import melalui `<input type="file">` dan drag/drop.
- Simpan proyek/gambar melalui download browser; File System Access API hanya tambahan opsional.
- Simpan otomatis menggunakan IndexedDB pada browser dan origin yang sama.
- Data lokal browser dapat dihapus pengguna; sediakan ekspor proyek sebagai cadangan permanen.
- Kamera, clipboard dan Web Share API memerlukan izin/dukungan browser dan tidak boleh menjadi satu-satunya cara menyelesaikan tugas.
- GitHub Pages bersifat opsional; semua fungsi editor dasar harus berjalan pada localhost tanpa backend.

## F. Kebutuhan kualitas dan aksesibilitas

- UI desktop-first, responsif untuk jendela lebih sempit.
- Pintasan keyboard untuk undo/redo, delete, copy/paste, duplicate, zoom, dan save/export.
- Tema terang/gelap; navigasi keyboard dan label kontrol yang jelas.
- Operasi berat tidak membekukan UI; gunakan Web Worker bila sesuai.
- Preview dan ekspor harus konsisten.
- Dokumen tetap dapat diedit setelah simpan/buka; aset hilang dilaporkan dengan jelas.
- Perubahan destruktif seperti merge, crop dan resize punya undo atau konfirmasi yang wajar.

## G. Daftar pengecekan cakupan

- [ ] Toolbar tambah, simpan, ekspor, share, quotes, menu, undo/redo, zoom, grid/snap, layers.
- [ ] Kelima tab: preset, teks, objek, latar/kanvas, efek global.
- [ ] Semua kontrol teks, efek 2D/3D, curve, perspective, mask, reflection.
- [ ] Semua objek: sticker, emoji, badge, shapes, arrow, draw, Bezier, import.
- [ ] Crop/reselect/filter/eraser/chroma key.
- [ ] Layer lock/hide/delete/duplicate/reorder/multi-select/merge.
- [ ] Canvas presets, custom size, background modes, grid, snap, zoom.
- [ ] Meme, quotes multikategori/multibahasa, saved presets/styles.
- [ ] Autosave, recovery, undo/redo, project archive, schema migration.
- [ ] PNG/JPEG export, alpha, custom dimensions/quality, preview/download/share fallback.
- [ ] Tidak ada AI; pengalaman lokal browser tanpa backend wajib.

