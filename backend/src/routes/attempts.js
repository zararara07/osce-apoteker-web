const express = require("express");
const { EXAM_DAYS } = require("../data/osceCatalog");
const { authMiddleware, sanitizeUser } = require("./auth");

const router = express.Router();
const FAST_TIMER = process.env.FAST_TIMER === "true";

// In-memory store untuk sesi ujian aktif (struktur cocok dengan schema.prisma)
const attempts = [];

function getTimerDurations(isRestStation) {
  if (isRestStation) {
    return {
      readSec: 0,
      workSec: FAST_TIMER ? 15 : 600,
      moveSec: FAST_TIMER ? 5 : 60,
    };
  }
  return {
    readSec: FAST_TIMER ? 8 : 60,
    workSec: FAST_TIMER ? 60 : 540,
    moveSec: FAST_TIMER ? 5 : 60,
  };
}

function getOrInitSubmission(attempt, stationNum) {
  if (!attempt.submissions[stationNum]) {
    const day = EXAM_DAYS[attempt.dayNumber];
    const station = day.stations.find((s) => s.stationNumber === stationNum);
    attempt.submissions[stationNum] = {
      stationNumber: stationNum,
      templateCode: station.templateCode,
      title: station.title,
      isRestStation: station.isRestStation,
      accStatus: station.requiresAccStage ? "PENDING" : "NOT_REQUIRED",
      formAnswers: {},
      events: [],
      unlockedClues: [],
      transcripts: [],
      competencies: {
        PENGUMPULAN_DATA: 0,
        PENETAPAN_MASALAH: 0,
        PENYELESAIAN_MASALAH: 0,
        PENCATATAN_PELAPORAN: 0,
        KOMUNIKASI_EFEKTIF: 0,
        SIKAP_PROFESIONAL: 0,
      },
      stationScore: 0,
      earnedXp: 0,
      submittedAt: null,
    };
  }
  return attempt.submissions[stationNum];
}

function computeStationScore(station, sub) {
  if (station.isRestStation) {
    return { score: 0, xp: 10, competencies: sub.competencies };
  }
  const eventCodes = new Set(sub.events.map((e) => e.eventCode));
  const formKeys = Object.keys(sub.formAnswers || {}).filter(
    (k) => String(sub.formAnswers[k] || "").trim().length > 0
  );

  const comp = {
    PENGUMPULAN_DATA: Math.min(100, (eventCodes.has("OPEN_REFERENCE") ? 50 : 20) + sub.unlockedClues.length * 40),
    PENETAPAN_MASALAH: Math.min(100, formKeys.length >= 1 ? 75 : 30),
    PENYELESAIAN_MASALAH: Math.min(
      100,
      (formKeys.length >= 2 ? 70 : 35) + (sub.accStatus === "APPROVED" ? 30 : 0)
    ),
    PENCATATAN_PELAPORAN: Math.min(100, formKeys.length * 35),
    KOMUNIKASI_EFEKTIF: station.hasMicrophone
      ? Math.min(100, sub.transcripts.length * 25 + sub.unlockedClues.length * 40)
      : 80,
    SIKAP_PROFESIONAL: Math.min(
      100,
      (eventCodes.has("WASH_HANDS") ? 45 : 15) +
        (eventCodes.has("WEAR_APD") || eventCodes.has("WEAR_STERILE_APD_ORDER") || eventCodes.has("CHECK_PATIENT_ID") ? 45 : 15) +
        10
    ),
  };

  const avgScore = Math.round(
    Object.values(comp).reduce((acc, v) => acc + v, 0) / 6
  );
  const xp = Math.max(20, Math.round(avgScore * 0.6) + sub.events.length * 5);
  return { score: avgScore, xp, competencies: comp };
}

// GET /api/exam-days — Daftar Paket Ujian Day 1, Day 2, Day 3
router.get("/exam-days", authMiddleware, (req, res) => {
  const list = Object.values(EXAM_DAYS).map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    subtitle: d.subtitle,
    stations: d.stations.map((s) => ({
      stationNumber: s.stationNumber,
      templateCode: s.templateCode,
      title: s.title,
      isRestStation: s.isRestStation,
      hasMicrophone: s.hasMicrophone,
      requiresAccStage: s.requiresAccStage,
    })),
  }));
  res.json({ examDays: list });
});

// POST /api/attempts/start — Mulai Putaran Baru (Station 1)
router.post("/attempts/start", authMiddleware, (req, res) => {
  const dayNumber = Number(req.body.dayNumber || 1);
  if (!EXAM_DAYS[dayNumber]) {
    return res.status(400).json({ error: "Paket Day tidak valid (pilih 1, 2, atau 3)." });
  }
  const attempt = {
    id: attempts.length + 1,
    userId: req.user.id,
    dayNumber,
    currentStation: 1,
    earnedXp: 0,
    totalScore: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    submissions: {},
  };
  attempts.push(attempt);
  res.status(201).json({ attempt });
});

// GET /api/attempts/:attemptId/station/:stationNum/bundle
router.get("/attempts/:attemptId/station/:stationNum/bundle", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const stationNum = Number(req.params.stationNum);
  const day = EXAM_DAYS[attempt.dayNumber];
  const station = day.stations.find((s) => s.stationNumber === stationNum);
  if (!station) return res.status(404).json({ error: "Station tidak ditemukan (harus 1-10)." });

  const sub = getOrInitSubmission(attempt, stationNum);
  res.json({
    attemptId: attempt.id,
    dayNumber: attempt.dayNumber,
    ...station,
    timer: getTimerDurations(station.isRestStation),
    submissionState: {
      accStatus: sub.accStatus,
      unlockedClues: sub.unlockedClues,
      eventsCount: sub.events.length,
      submittedAt: sub.submittedAt,
    },
  });
});

// POST /api/attempts/:attemptId/station/:stationNum/events (Azzahra — Klik 3D Godot)
router.post("/attempts/:attemptId/station/:stationNum/events", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const stationNum = Number(req.params.stationNum);
  const sub = getOrInitSubmission(attempt, stationNum);
  const { eventCode, payload = {} } = req.body;
  if (!eventCode) return res.status(400).json({ error: "eventCode wajib diisi." });

  const alreadyRecorded = sub.events.some((e) => e.eventCode === eventCode);
  sub.events.push({ eventCode, payload, createdAt: new Date().toISOString() });

  const xpDelta = alreadyRecorded ? 0 : 10;
  attempt.earnedXp += xpDelta;
  res.json({ recorded: true, eventCode, xpDelta, totalAttemptXp: attempt.earnedXp });
});

// POST /api/attempts/:attemptId/station/:stationNum/acc (Devana — Alur Bertahap ACC T1)
router.post("/attempts/:attemptId/station/:stationNum/acc", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const stationNum = Number(req.params.stationNum);
  const sub = getOrInitSubmission(attempt, stationNum);
  sub.formAnswers = { ...sub.formAnswers, ...(req.body.worksheet1 || {}) };
  sub.accStatus = "APPROVED";
  attempt.earnedXp += 20;

  res.json({
    accStatus: "APPROVED",
    message: "Penguji menyetujui (ACC) Worksheet 1! Worksheet 2 kini terbuka.",
    xpDelta: 20,
  });
});

// POST /api/attempts/:attemptId/station/:stationNum/npc-talk (Azzahra — Mikrofon & Clue NPC)
router.post("/attempts/:attemptId/station/:stationNum/npc-talk", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const stationNum = Number(req.params.stationNum);
  const day = EXAM_DAYS[attempt.dayNumber];
  const station = day.stations.find((s) => s.stationNumber === stationNum);
  const sub = getOrInitSubmission(attempt, stationNum);

  const spokenText = String(req.body.spokenText || "").trim();
  const lower = spokenText.toLowerCase();

  let matchedClue = null;
  let replyText = "Baik apoteker, silakan tanyakan keluhan, riwayat obat, atau kondisi khusus saya.";
  let commScoreDelta = 5;

  for (const clue of station.npcClues || []) {
    if (clue.keywords.some((kw) => lower.includes(kw))) {
      matchedClue = clue.clueKey;
      replyText = clue.reply;
      commScoreDelta = 20;
      if (!sub.unlockedClues.includes(clue.clueKey)) {
        sub.unlockedClues.push(clue.clueKey);
        attempt.earnedXp += 15;
      }
      break;
    }
  }

  sub.transcripts.push({
    spokenText,
    matchedClue,
    replyText,
    createdAt: new Date().toISOString(),
  });

  res.json({
    matched: Boolean(matchedClue),
    unlockedClue: matchedClue,
    allUnlockedClues: sub.unlockedClues,
    replyText,
    npcAnim: "TALK_LIPSYNC",
    commScoreDelta,
    totalAttemptXp: attempt.earnedXp,
  });
});

// POST /api/attempts/:attemptId/station/:stationNum/submit — Simpan & Lanjut Station
router.post("/attempts/:attemptId/station/:stationNum/submit", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const stationNum = Number(req.params.stationNum);
  const day = EXAM_DAYS[attempt.dayNumber];
  const station = day.stations.find((s) => s.stationNumber === stationNum);
  const sub = getOrInitSubmission(attempt, stationNum);

  sub.formAnswers = { ...sub.formAnswers, ...(req.body.formAnswers || {}) };
  const result = computeStationScore(station, sub);
  sub.stationScore = result.score;
  sub.earnedXp = result.xp;
  sub.competencies = result.competencies;
  sub.submittedAt = new Date().toISOString();

  attempt.earnedXp += result.xp;

  const isFinished = stationNum >= 10;
  if (isFinished) {
    attempt.finishedAt = new Date().toISOString();
    const scoredSubs = Object.values(attempt.submissions).filter((s) => !s.isRestStation);
    attempt.totalScore = scoredSubs.length
      ? Math.round(scoredSubs.reduce((acc, s) => acc + s.stationScore, 0) / scoredSubs.length)
      : 0;

    // Update Gamifikasi User (XP, Level, Badges)
    req.user.totalXp += attempt.earnedXp;
    req.user.level = Math.max(1, Math.floor(req.user.totalXp / 200) + 1);
    const newBadges = [];
    if (!req.user.badges.includes(`FINISH_DAY_${attempt.dayNumber}`)) {
      const code = `FINISH_DAY_${attempt.dayNumber}`;
      req.user.badges.push(code);
      newBadges.push(code);
    }
    if (attempt.totalScore >= 75 && !req.user.badges.includes("KOMPETEN_UKMPPAI")) {
      req.user.badges.push("KOMPETEN_UKMPPAI");
      newBadges.push("KOMPETEN_UKMPPAI");
    }

    return res.json({
      finished: true,
      nextStation: null,
      stationScore: sub.stationScore,
      earnedXp: sub.earnedXp,
      newBadges,
      user: sanitizeUser(req.user),
    });
  }

  attempt.currentStation = stationNum + 1;
  res.json({
    finished: false,
    nextStation: attempt.currentStation,
    stationScore: sub.stationScore,
    earnedXp: sub.earnedXp,
    totalAttemptXp: attempt.earnedXp,
  });
});

// GET /api/attempts/:attemptId/report — Rapor Evaluasi Akhir OSCE
router.get("/attempts/:attemptId/report", authMiddleware, (req, res) => {
  const attempt = attempts.find((a) => a.id === Number(req.params.attemptId));
  if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });

  const day = EXAM_DAYS[attempt.dayNumber];
  const stationReports = day.stations.map((s) => {
    const sub = attempt.submissions[s.stationNumber];
    return {
      stationNumber: s.stationNumber,
      templateCode: s.templateCode,
      title: s.title,
      isRestStation: s.isRestStation,
      hasMicrophone: s.hasMicrophone,
      stationScore: sub ? sub.stationScore : 0,
      unlockedClues: sub ? sub.unlockedClues : [],
      eventsCount: sub ? sub.events.length : 0,
      transcriptsCount: sub ? sub.transcripts.length : 0,
    };
  });

  const activeSubs = Object.values(attempt.submissions).filter((s) => !s.isRestStation);
  const compKeys = [
    "PENGUMPULAN_DATA",
    "PENETAPAN_MASALAH",
    "PENYELESAIAN_MASALAH",
    "PENCATATAN_PELAPORAN",
    "KOMUNIKASI_EFEKTIF",
    "SIKAP_PROFESIONAL",
  ];
  const competencySummary = {};
  compKeys.forEach((k) => {
    competencySummary[k] = activeSubs.length
      ? Math.round(activeSubs.reduce((acc, s) => acc + (s.competencies[k] || 0), 0) / activeSubs.length)
      : 0;
  });

  res.json({
    attemptId: attempt.id,
    dayNumber: attempt.dayNumber,
    dayTitle: day.title,
    totalScore: attempt.totalScore,
    earnedXp: attempt.earnedXp,
    finishedAt: attempt.finishedAt,
    user: sanitizeUser(req.user),
    competencySummary,
    stationReports,
  });
});

module.exports = { attemptsRouter: router };
