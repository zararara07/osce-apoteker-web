# Web Simulator 3D OSCE Apoteker UKMPPAI

Starter project untuk simulator OSCE dengan **Node.js + Express + Socket.IO + React/Vite + PostgreSQL/Prisma + Godot 4.3 Web**.

## Fitur yang tersedia

- Registrasi peserta dan login email/kata sandi dengan JWT.
- Dashboard paket Day 1–Day 3. Day 1 dan Day 2 dapat dimulai setelah database di-seed. Day 3 tampil sebagai belum lengkap karena soal Station 10 belum diterima.
- Pembuatan attempt, rute 10 station sesuai paket hari, dengan Station 5 sebagai ruang istirahat T10.
- Timer server tiga fase untuk tiap station: baca 60 detik, kerja 540 detik, pindah 60 detik. `FAST_TIMER=true` tersedia untuk development.
- Bundle station dan item dikirim ke wrapper web/Godot, jawaban disimpan di submission, dan rapor dasar tampil setelah attempt selesai.
- Timer attempt disimpan di PostgreSQL sehingga fase aktif dapat dipulihkan setelah halaman dimuat ulang.

## Struktur

- `backend/` — Express API, JWT auth, Socket.IO timer, Prisma schema dan seed.
- `frontend/` — React/Vite untuk login, dashboard, alur ujian, HUD timer, serta wrapper integrasi Godot.
- `godot-bridge-example/` — Contoh jembatan komunikasi Godot Web.

## Menjalankan lokal

### 1. Siapkan PostgreSQL

Buat database bernama `osce_apoteker`, lalu salin `backend/.env.example` menjadi `backend/.env` dan sesuaikan `DATABASE_URL` serta `JWT_SECRET`.

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

### 2. Migrasi dan isi paket soal awal

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init_osce_schema
npm run prisma:seed
npm run dev
```

Backend berjalan di `http://localhost:4000`. Health check: `GET /api/health`.

Seed mengisi template T1–T10, 10 station Day 1 dan Day 2, serta sembilan soal Day 3. Day 3 tidak dapat dimulai sampai Station 10 dimasukkan melalui CMS atau seed berikutnya.

### 3. Jalankan frontend

Di terminal terpisah:

```powershell
cd frontend
npm install
npm run dev
```

Buka alamat Vite yang tampil di terminal (default `http://localhost:5173`), lalu buat akun peserta dari layar masuk.

Jika backend bukan di `http://localhost:4000`, atur `VITE_API_URL` di `frontend/.env.local`.

## Catatan integrasi

- Socket.IO memvalidasi JWT dan keanggotaan attempt sebelum mengirim status timer.
- API tidak mengirim jawaban rubrik/kunci tersembunyi dalam Station Bundle.
- Konten seed adalah scaffold alur berdasarkan brief dan perlu disetujui tim farmasi/dosen sebelum dipakai sebagai ujian.
- Jangan push langsung ke `main`. Gunakan branch fitur dan ajukan Pull Request ke `staging` sesuai aturan tim.
