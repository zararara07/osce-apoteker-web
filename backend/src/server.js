require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const FAST_TIMER = process.env.FAST_TIMER === "true";

// ============================================================================
// 1. ROOT & HEALTH CHECK (HARI 1 — TES KONEKSI BERSAMA)
// ============================================================================
app.get("/", (req, res) => {
  res.json({
    message: "OSCE Apoteker UKMPPAI Backend berjalan normal!",
    endpoints: {
      health: "GET /api/health",
      stationBundle: "GET /api/attempts/1/station/3/bundle",
      restStation: "GET /api/attempts/1/station/5/bundle",
      godotEvent: "POST /api/submissions/1/events",
      npcTalk: "POST /api/submissions/1/npc-talk",
    },
    frontendUrl: "http://localhost:5173",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "OSCE Apoteker UKMPPAI Backend",
    fastTimerMode: FAST_TIMER,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// 2. STARTER ENDPOINT DEVANA (CORE OSCE, STATION BUNDLE & TIMER 3 FASE)
// ============================================================================

// Contoh Station Bundle Dummy untuk Azzahra & Tim 3D (Godot) di Minggu 1
app.get("/api/attempts/:attemptId/station/:stationNum/bundle", (req, res) => {
  const stationNum = Number(req.params.stationNum);

  // Aturan wajib: Station 5 selalu Ruang Istirahat (Template 10)
  if (stationNum === 5) {
    return res.json({
      stationNumber: 5,
      isRestStation: true,
      template: { code: "T10", scenePath: "res://scenes/T10_istirahat.tscn" },
      hasMicrophone: false,
      doorInstruction: "Ruang Istirahat. Tidak ada soal pada station ini.",
      timer: {
        readSec: 0,
        workSec: FAST_TIMER ? 15 : 600,
        moveSec: FAST_TIMER ? 5 : 60,
      },
      items: [],
      allowedReferences: [],
      forms: [],
    });
  }

  // Contoh kasus dummy Day 1 Station 3 (Template 6 — Swamedikasi Interaktif Mic)
  return res.json({
    stationNumber: stationNum,
    isRestStation: false,
    template: { code: "T6", scenePath: "res://scenes/T6_swamedikasi.tscn" },
    hasMicrophone: true,
    doorInstruction:
      "Pasien datang mengeluh nyeri kepala dan demam. Lakukan penggalian informasi, pilih obat sesuai regulasi, dan berikan PIO lengkap.",
    timer: {
      readSec: FAST_TIMER ? 10 : 60,
      workSec: FAST_TIMER ? 45 : 540,
      moveSec: FAST_TIMER ? 5 : 60,
    },
    items: [
      {
        slotId: "rack_A1",
        model3dKey: "tablet_strip",
        name: "Parasetamol 500 mg (Sanmol)",
        drugClass: "BEBAS",
        condition: "GOOD",
        expDate: "2028-04",
      },
      {
        slotId: "rack_A2",
        model3dKey: "tablet_strip",
        name: "Ibuprofen 400 mg",
        drugClass: "BEBAS_TERBATAS",
        condition: "GOOD",
        expDate: "2028-01",
      },
      {
        slotId: "rack_K1",
        model3dKey: "tablet_strip",
        name: "Asam Mefenamat 500 mg (Pengecoh Obat Keras)",
        drugClass: "KERAS",
        condition: "GOOD",
        isDistractor: true,
      },
    ],
    allowedReferences: ["ISO", "MIMS", "BUKU_KIA"],
    forms: ["FORM_SWAMEDIKASI_PIO", "ETIKET_PUTIH"],
  });
});

// ============================================================================
// 3. STARTER ENDPOINT AZZAHRA (EVENT 3D GODOT & MIKROFON NPC CLUE)
// ============================================================================

// Menangkap klik objek 3D dari Godot (cuci tangan, APD, buka referensi, pilah limbah)
app.post("/api/submissions/:submissionId/events", (req, res) => {
  const { submissionId } = req.params;
  const { eventCode, payload } = req.body;

  console.log(`[GODOT EVENT] submission=${submissionId} event=${eventCode}`, payload || {});
  res.json({
    recorded: true,
    submissionId,
    eventCode,
    xpDelta: eventCode === "WASH_HANDS" ? 10 : 5,
  });
});

// Prototipe interaksi Mikrofon -> Cek kata kunci -> Buka Clue Tersembunyi NPC
app.post("/api/submissions/:submissionId/npc-talk", (req, res) => {
  const text = (req.body.spokenText || "").toLowerCase();

  if (text.includes("hamil") || text.includes("menyusui") || text.includes("kandungan")) {
    return res.json({
      matched: true,
      unlockedClue: "CLUE_IBU_HAMIL",
      replyText: "Iya apoteker, saya sedang hamil usia 5 bulan. Apakah obatnya aman untuk janin?",
      npcAnim: "TALK_LIPSYNC",
      commScoreDelta: 15,
    });
  }

  if (text.includes("alergi")) {
    return res.json({
      matched: true,
      unlockedClue: "CLUE_ALERGI",
      replyText: "Saya tidak ada alergi obat, tapi lambung saya sering perih kalau minum obat nyeri tertentu.",
      npcAnim: "TALK_LIPSYNC",
      commScoreDelta: 15,
    });
  }

  return res.json({
    matched: false,
    unlockedClue: null,
    replyText: "Saya merasa pusing dan agak meriang sejak kemarin sore, apoteker. Baiknya minum obat apa ya?",
    npcAnim: "TALK_LIPSYNC",
    commScoreDelta: 0,
  });
});

// ============================================================================
// 4. WEBSOCKET TIMER 3 FASE (DEVANA)
// ============================================================================
io.on("connection", (socket) => {
  console.log(`[WS] Client terhubung: ${socket.id}`);

  socket.on("timer:start", ({ stationNumber = 1 }) => {
    const phases = [
      { phase: "READ", sec: FAST_TIMER ? 10 : 60 },
      { phase: "WORK", sec: FAST_TIMER ? 45 : 540 },
      { phase: "MOVE", sec: FAST_TIMER ? 5 : 60 },
    ];
    let idx = 0;
    let remaining = phases[0].sec;

    const interval = setInterval(() => {
      socket.emit("timer:tick", {
        stationNumber,
        phase: phases[idx].phase,
        remainingSec: remaining,
      });

      remaining -= 1;
      if (remaining < 0) {
        idx += 1;
        if (idx >= phases.length) {
          clearInterval(interval);
          socket.emit("timer:station_done", { stationNumber });
        } else {
          remaining = phases[idx].sec;
        }
      }
    }, 1000);

    socket.on("disconnect", () => clearInterval(interval));
  });
});

server.listen(PORT, () => {
  console.log(`OSCE Backend aktif di http://localhost:${PORT} (FAST_TIMER=${FAST_TIMER})`);
});
