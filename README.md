# CEKATAN Dummy — Firebase + Vercel

Purwarupa timbang terima Ruangan Kenanga yang datanya disimpan di **Firebase Firestore** dan halamannya di-*hosting* di **Vercel**. Tujuannya untuk merasakan langsung bedanya dengan versi Apps Script + Spreadsheet: dua ponsel yang membuka halaman yang sama akan melihat perubahan dalam hitungan detik, tanpa perlu menyegarkan halaman.

---

## Isi berkas

| Berkas | Perannya |
|---|---|
| `index.html` | Kerangka tampilan |
| `styles.css` | Gaya tampilan |
| `app.js` | Otak aplikasi — menyambung ke Firestore, mendengarkan perubahan, menggambar kartu pasien |
| `firebase-config.js` | **Satu-satunya berkas yang wajib Anda ubah** |
| `firestore.rules` | Aturan siapa yang boleh baca/tulis data |
| `vercel.json` | Pengaturan kecil untuk Vercel |
| `Arsip.gs` | Opsional — menarik data Firestore ke Spreadsheet untuk arsip & rekap |

Tidak ada `npm install`, tidak ada proses *build*. Ini sengaja HTML biasa supaya alurnya kelihatan telanjang.

---

## Langkah 1 — Buat proyek Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com), masuk dengan akun Google.
2. **Create a project** → beri nama, misalnya `cekatan-kenanga`.
3. Google Analytics boleh dimatikan (tidak dipakai) → **Create project**.

## Langkah 2 — Ambil konfigurasi

1. Di halaman depan proyek, klik ikon **`</>`** (Web).
2. Beri nama aplikasi, misalnya `cekatan-web`. **Jangan** centang Firebase Hosting.
3. Firebase menampilkan potongan kode berisi `apiKey`, `projectId`, dan seterusnya.
4. Salin nilai-nilai itu ke `firebase-config.js`, ganti semua tulisan `GANTI_...`.

> **Soal keamanan:** `apiKey` Firebase memang boleh terlihat publik — dia hanya penunjuk alamat proyek, bukan kunci rahasia. Yang benar-benar menjaga data adalah aturan di Langkah 4.

## Langkah 3 — Nyalakan Firestore

1. Menu kiri → **Build → Firestore Database → Create database**.
2. Pilih lokasi `asia-southeast2 (Jakarta)` agar aksesnya cepat dari Indonesia.
3. Pilih **Start in test mode** → **Enable**.

Koleksi `pasien` tidak perlu dibuat manual. Firestore membuatnya sendiri saat pasien pertama disimpan.

## Langkah 4 — Pasang aturan keamanan

Buka tab **Rules** di Firestore, hapus isinya, tempel **Pilihan A** dari `firestore.rules`, lalu **Publish**.

Mode ini membuat siapa pun yang tahu alamat proyek bisa membaca dan menulis. Cukup untuk mencoba dengan data karangan, **tidak boleh** untuk data pasien sungguhan. Untuk itu ada Pilihan B, yang menuntut login lebih dulu.

## Langkah 5 — Coba di komputer sendiri

Buka Terminal / Command Prompt di dalam folder proyek:

```bash
npx serve .
```

Buka alamat yang muncul (biasanya `http://localhost:3000`).

Membuka `index.html` dengan klik ganda **tidak akan jalan** — berkas `app.js` memakai modul JavaScript yang diblokir browser saat dibuka dari alamat `file://`.

Kalau lampu di pojok kanan atas menyala hijau bertuliskan "tersambung", berarti Firebase sudah nyambung. Coba tambah satu pasien, lalu buka alamat yang sama di jendela lain — datanya muncul sendiri.

## Langkah 6 — Naikkan ke Vercel

**Cara cepat lewat terminal:**

```bash
npm i -g vercel
vercel login
vercel          # jawab pertanyaannya dengan Enter saja
vercel --prod   # menerbitkan versi publik
```

**Cara lewat GitHub (lebih enak untuk jangka panjang):**

1. Unggah folder ini ke sebuah repositori GitHub.
2. Buka [vercel.com](https://vercel.com) → **Add New → Project** → pilih repositori tadi.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan.
4. **Deploy**.

Selesai. Vercel memberi alamat semacam `cekatan-kenanga.vercel.app` yang bisa dibuka dari ponsel mana pun. Setiap kali Anda memperbarui kode di GitHub, Vercel menerbitkan ulang sendiri.

## Langkah 7 — Kunci domainnya

Supaya proyek Firebase tidak bisa dipakai dari situs lain:

**Firebase Console → Authentication → Settings → Authorized domains** → tambahkan alamat Vercel Anda, hapus yang tidak perlu.

---

## Cara membacanya sebagai alur

```
   Petugas (ponsel/PC)
          │
          ▼
   Halaman di VERCEL           ← tampilan saja, tidak menyimpan data
          │  onSnapshot()
          ▼
   FIRESTORE (Firebase)        ← database aktif, real-time
          │  (opsional, tiap 1 jam)
          ▼
   Apps Script  ➜  SPREADSHEET ← arsip, rekap DPJP, bahan cetak
```

Perbedaan pokok dengan CEKATAN sekarang: di Apps Script, halaman **meminta** data setiap kali dibuka. Di Firestore, halaman **berlangganan** — begitu ada perubahan, Firestore yang mengirim kabar ke semua perangkat yang sedang membuka.

---

## Yang sengaja belum ada di dummy ini

Supaya alurnya tetap terbaca, beberapa hal ditinggalkan dan perlu ditambahkan sebelum dipakai sungguhan:

- **Login.** Sekarang cuma gerbang nama + shift, sama seperti versi berjalan. Untuk data pasien wajib pakai Firebase Authentication.
- **Menu cetak.** Belum ada; di versi sekarang ini fitur yang paling sering dipakai.
- **Riwayat perubahan.** Baru mencatat nama & waktu terakhir mengubah, belum menyimpan jejak lengkap tiap poin rencana.
- **Rekap per DPJP.** Di Spreadsheet cukup rumus; di Firestore harus dikoding.

Poin terakhir itu alasan utama Spreadsheet sebaiknya tidak dibuang. Biarkan Firestore memegang pasien yang sedang dirawat, Spreadsheet memegang arsip dan laporan.

---

## Kalau macet

| Gejala | Kemungkinan sebab |
|---|---|
| Lampu merah "konfigurasi belum diisi" | `firebase-config.js` masih berisi tulisan `GANTI_...` |
| Lampu merah "gagal menyambung" | Aturan Firestore belum dipublikasikan, atau Firestore belum dinyalakan |
| Halaman putih, di Console ada `Failed to load module script` | Dibuka lewat klik ganda; harus lewat `npx serve .` atau Vercel |
| Data tersimpan tapi tidak muncul | Pasien berstatus selain DIRAWAT — centang "Tampilkan pasien yang sudah keluar" |
| `Missing or insufficient permissions` | Aturan di tab Rules masih menolak; pastikan Pilihan A sudah di-*publish* |
