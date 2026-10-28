# CanvasArt

Editor desain grafis lokal berbasis web. Source project ditujukan untuk dikembangkan secara terbuka dan dijalankan di komputer pengguna melalui browser.

## Menjalankan secara lokal

Persyaratan: Node.js 22 LTS (22.12 atau lebih baru) dan npm.

```sh
npm install
npm run dev
```

Buka URL localhost yang dicetak Vite di terminal.

## Build

```sh
npm run build
npm run preview
```

## Status

CanvasArt sedang dibangun; fitur lengkap yang ditargetkan belum selesai. Fondasi antarmuka, kanvas berlayer, teks/bentuk/gambar dasar, gradasi linear/radial dan tekstur gambar untuk isi teks serta objek vektor, teks melengkung, font TTF/OTF lokal, pustaka 24 stiker SVG orisinal dengan pencarian/kategori/favorit lokal dan emoji teks sistem, Bezier dengan handle kurva saat menggambar dan edit anchor/handle setelah path dibuat, crop gambar nondestruktif, ganti sumber gambar, filter gambar per layer, penghapus manual per gambar, merge layer, grouping/ungrouping dan align/distribute dasar, chroma key dasar, undo/redo, autosave browser, proyek arsip (termasuk pengaturan kuas), rotasi teks X/Y ortografik dengan pemendekan sumbu, ekstrusi teks 3D semu dengan kedalaman, sudut, warna, penggelapan sisi, mode oblique/perspektif semu, serta simulasi arah/intensitas/ambient cahaya, warp perspektif empat titik berbasis mesh raster dengan layer sumber yang dapat dipulihkan, mask nondestruktif elips/persegi serta path Bezier In/Out pada objek (mask mengikuti perubahan bentuk/transformasi path sumber; path dipulihkan saat mask dilepas), bayangan luar gambar/bentuk dengan warna/blur/offset/glow, Emboss teks dengan sudut cahaya, intensitas, ambient, hardness, dan bevel; Inner Shadow teks dengan warna/blur/offset/opacity, Reflection teks dengan jarak/panjang/opacity, 3D Shadow lantai dengan arah/panjang/jarak/blur/opacity, efek global dasar, ekspor PNG/JPEG dengan kontrol kualitas JPEG, dimensi kustom dan pilihan pertahankan proporsi/regang, preview ekspor, serta berbagi gambar melalui Web Share API dengan fallback unduh tersedia. Katalog stiker belum mencapai target ratusan aset dan sejumlah fitur lanjutan lain belum tersedia. Lihat [spesifikasi fitur](docs/FEATURES.md), [blueprint](docs/BLUEPRINT.md), dan [roadmap](docs/ROADMAP.md) untuk cakupan dan status.

Tidak ada fitur AI atau backend wajib. Gambar dan proyek pengguna diproses lokal di browser.

## Lisensi dan aset

Lisensi proyek dan inventaris aset perlu ditetapkan sebelum publikasi GitHub. Jangan menambahkan font, stiker, kutipan, atau gambar tanpa izin redistribusi yang jelas.
