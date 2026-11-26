# Web Simulator 3D OSCE Apoteker UKMPPAI

Starter repository untuk **Tim Backend & Database (Devana, Azzahra, Gilang)** serta jembatan integrasi **Godot 4.3+ Web** (Tim 3D).

## Struktur Folder

- `backend/` — Node.js + Express + Socket.IO + Prisma ORM (PostgreSQL)
  - `prisma/schema.prisma` — Skema database *data-driven* (Tugas utama: **Gilang**)
  - `src/server.js` — Starter REST API + Timer 3 Fase Socket.IO (**Devana**) & Endpoint Event 3D + Mic NPC (**Azzahra**)
- `frontend/` — React + Vite Web Wrapper, Tes Mikrofon (`Web Speech API`), HUD Timer, & `godotBridge.js` (**Azzahra**)
- `godot-bridge-example/WebBridge.gd` — Contoh Autoload GDScript untuk **Tim 3D (Godot 4.3+)** agar bisa berkomunikasi 2 arah dengan Web

## Cara Menjalankan di Laptop (Hari 1)

### 1. Jalankan Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Cek di browser atau Postman: `GET http://localhost:4000/api/health`

### 2. Setup Database (Gilang)
Setelah PostgreSQL aktif dan `DATABASE_URL` diisi di `backend/.env`:
```bash
cd backend
npx prisma migrate dev --name init_osce_schema
npx prisma studio
```

### 3. Jalankan Frontend & Tes Mikrofon (Azzahra)
```bash
cd frontend
npm install
npm run dev
```
Buka `http://localhost:5173` di Google Chrome / Microsoft Edge.

## Aturan Git Tim
- Jangan *push* langsung ke `main`.
- Branch masing-masing: `dev/devana`, `dev/azzahra`, `dev/gilang`.
- Gabungkan (*Pull Request*) ke branch `staging` terlebih dahulu.
