require("dotenv").config();

const http = require("http");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient, TimerPhase, AccStatus } = require("@prisma/client");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const appSecret = process.env.JWT_SECRET || "local-dev-secret-change-before-deploy";
const fastTimer = process.env.FAST_TIMER === "true";
const io = new Server(server, { cors: { origin: corsOrigin } });

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET wajib diatur di environment production.");
}

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, nimOrNip: user.nimOrNip, role: user.role };
}

function signToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, appSecret, { expiresIn: "12h" });
}

function authRequired(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Silakan masuk terlebih dahulu." });
  try {
    req.auth = jwt.verify(token, appSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Sesi tidak valid atau sudah berakhir. Silakan masuk kembali." });
  }
}

function durationsFor(stationCase) {
  if (fastTimer) return { read: 10, work: 45, move: 5 };
  return {
    read: stationCase?.readSeconds ?? 60,
    work: stationCase?.workSeconds ?? 540,
    move: stationCase?.moveSeconds ?? 60,
  };
}

function phaseLength(phase, durations) {
  if (phase === TimerPhase.READ) return durations.read;
  if (phase === TimerPhase.WORK) return durations.work;
  if (phase === TimerPhase.MOVE) return durations.move;
  return 0;
}

function remainingSeconds(phaseEndsAt) {
  if (!phaseEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000));
}

function attemptState(attempt) {
  return {
    id: attempt.id,
    dayNumber: attempt.examDay.dayNumber,
    currentStation: attempt.currentStation,
    currentPhase: attempt.currentPhase,
    phaseEndsAt: attempt.phaseEndsAt,
    remainingSec: remainingSeconds(attempt.phaseEndsAt),
    finishedAt: attempt.finishedAt,
  };
}

async function findOwnedAttempt(attemptId, userId) {
  const id = Number(attemptId);
  if (!Number.isInteger(id) || id < 1) return null;
  return prisma.examAttempt.findFirst({
    where: { id, userId },
    include: { examDay: true },
  });
}

async function stationBundle(attempt, stationNumber) {
  const stationCase = await prisma.stationCase.findUnique({
    where: { examDayId_stationNumber: { examDayId: attempt.examDayId, stationNumber } },
    include: { template: true, items: { include: { drugBank: true } }, allowedReferences: { include: { referenceBook: true } } },
  });
  if (!stationCase) return null;

  const submission = await prisma.stationSubmission.findUnique({
    where: { attemptId_stationCaseId: { attemptId: attempt.id, stationCaseId: stationCase.id } },
  });
  const durations = durationsFor(stationCase);

  return {
    attemptId: attempt.id,
    dayNumber: attempt.examDay.dayNumber,
    stationNumber,
    isRestStation: stationCase.template.isRestRoom,
    submissionId: submission?.id || null,
    template: { code: stationCase.template.code, name: stationCase.template.name, scenePath: stationCase.template.scenePath },
    hasMicrophone: stationCase.hasMicrophone,
    doorInstruction: stationCase.doorInstructionText,
    timer: { readSec: durations.read, workSec: durations.work, moveSec: durations.move },
    items: stationCase.items.map((item) => ({
      slotId: item.slotId,
      model3dKey: item.drugBank.model3dKey,
      name: item.customLabelJson?.name || [item.drugBank.genericName, item.drugBank.strength, item.drugBank.brandName ? `(${item.drugBank.brandName})` : ""].filter(Boolean).join(" "),
      drugClass: item.drugBank.drugClass,
      condition: item.visualCondition,
      expDate: item.expDate,
      isDistractor: item.isDistractor,
    })),
    allowedReferences: stationCase.allowedReferences.map(({ referenceBook }) => referenceBook.code),
    forms: stationCase.caseDataJson?.formCodes || [],
    accStatus: submission?.accStatus || (stationCase.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED),
    savedAnswers: submission?.formAnswersJson || null,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "OSCE Apoteker UKMPPAI Backend", fastTimerMode: fastTimer, timestamp: new Date().toISOString() });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, nimOrNip, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !nimOrNip?.trim() || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Nama, email, NIM/NIP, dan kata sandi minimal 8 karakter wajib diisi." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.trim().toLowerCase(), nimOrNip: nimOrNip.trim(), passwordHash, role: "STUDENT" },
    });
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email atau NIM/NIP sudah terdaftar." });
    return next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || typeof password !== "string") return res.status(400).json({ error: "Email dan kata sandi wajib diisi." });
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Email atau kata sandi salah." });
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/auth/me", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.auth.sub) } });
    if (!user) return res.status(401).json({ error: "Akun tidak ditemukan." });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/exams/days", authRequired, async (_req, res, next) => {
  try {
    const days = await prisma.examDay.findMany({
      where: { isActive: true }, orderBy: { dayNumber: "asc" },
      include: { _count: { select: { stationCases: true } } },
    });
    return res.json({ days: days.map((day) => ({
      dayNumber: day.dayNumber,
      title: day.title,
      stationCount: day._count.stationCases,
      expectedStations: 10,
      isReady: day._count.stationCases === 10,
      missingStations: day._count.stationCases === 10 ? [] : [10],
      stationLengthMinutes: 11,
    })) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/attempts", authRequired, async (req, res, next) => {
  try {
    const dayNumber = Number(req.body?.dayNumber);
    if (![1, 2, 3].includes(dayNumber)) return res.status(400).json({ error: "Pilih Day 1, Day 2, atau Day 3." });
    const day = await prisma.examDay.findUnique({ where: { dayNumber }, include: { _count: { select: { stationCases: true } } } });
    if (!day || !day.isActive) return res.status(404).json({ error: "Paket ujian belum tersedia." });
    if (day._count.stationCases !== 10) return res.status(409).json({ error: `Day ${dayNumber} belum lengkap: soal seluruh 10 station harus tersedia sebelum ujian dimulai.` });

    const firstStation = await prisma.stationCase.findUnique({
      where: { examDayId_stationNumber: { examDayId: day.id, stationNumber: 1 } },
    });
    if (!firstStation) return res.status(409).json({ error: "Konfigurasi Station 1 belum tersedia." });
    const duration = durationsFor(firstStation);
    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.examAttempt.create({
        data: {
          userId: Number(req.auth.sub),
          examDayId: day.id,
          currentStation: 1,
          currentPhase: TimerPhase.READ,
          phaseEndsAt: new Date(Date.now() + duration.read * 1000),
        },
        include: { examDay: true },
      });
      await tx.stationSubmission.create({
        data: { attemptId: created.id, stationCaseId: firstStation.id, accStatus: firstStation.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED },
      });
      return created;
    });
    return res.status(201).json({ attempt: attemptState(attempt) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/attempts/:attemptId", authRequired, async (req, res, next) => {
  try {
    const attempt = await findOwnedAttempt(req.params.attemptId, Number(req.auth.sub));
    if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });
    const cases = await prisma.stationCase.findMany({
      where: { examDayId: attempt.examDayId }, orderBy: { stationNumber: "asc" }, include: { template: true },
    });
    return res.json({
      attempt: attemptState(attempt),
      stations: Array.from({ length: 10 }, (_, i) => {
        const stationNumber = i + 1;
        const stationCase = cases.find((item) => item.stationNumber === stationNumber);
        return stationCase ? { stationNumber, title: stationCase.title, templateCode: stationCase.template.code, isRestStation: stationCase.template.isRestRoom } : { stationNumber, title: "Soal belum tersedia", templateCode: null, isMissing: true };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/attempts/:attemptId/report", authRequired, async (req, res, next) => {
  try {
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: Number(req.params.attemptId), userId: Number(req.auth.sub) },
      include: { examDay: true, submissions: { include: { stationCase: { include: { template: true } } } } },
    });
    if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });
    if (!attempt.finishedAt) return res.status(409).json({ error: "Rapor tersedia setelah seluruh station selesai." });
    return res.json({
      dayNumber: attempt.examDay.dayNumber,
      finishedAt: attempt.finishedAt,
      totalScore: attempt.totalScore,
      earnedXp: attempt.earnedXp,
      stations: attempt.submissions.sort((a, b) => a.stationCase.stationNumber - b.stationCase.stationNumber).map((submission) => ({
        stationNumber: submission.stationCase.stationNumber,
        title: submission.stationCase.title,
        templateCode: submission.stationCase.template.code,
        score: submission.stationScore,
        completed: Boolean(submission.submittedAt),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/attempts/:attemptId/station/:stationNum/bundle", authRequired, async (req, res, next) => {
  try {
    const attempt = await findOwnedAttempt(req.params.attemptId, Number(req.auth.sub));
    const stationNum = Number(req.params.stationNum);
    if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });
    if (attempt.finishedAt || stationNum !== attempt.currentStation) return res.status(409).json({ error: "Station ini bukan station aktif." });
    const bundle = await stationBundle(attempt, stationNum);
    if (!bundle) return res.status(404).json({ error: "Soal station belum tersedia." });
    return res.json(bundle);
  } catch (error) {
    return next(error);
  }
});

app.put("/api/attempts/:attemptId/stations/:stationNum/answers", authRequired, async (req, res, next) => {
  try {
    const attempt = await findOwnedAttempt(req.params.attemptId, Number(req.auth.sub));
    const stationNum = Number(req.params.stationNum);
    if (!attempt) return res.status(404).json({ error: "Sesi ujian tidak ditemukan." });
    if (attempt.currentStation !== stationNum || attempt.currentPhase !== TimerPhase.WORK || attempt.finishedAt) {
      return res.status(409).json({ error: "Jawaban hanya dapat disimpan pada fase mengerjakan station aktif." });
    }
    const stationCase = await prisma.stationCase.findUnique({ where: { examDayId_stationNumber: { examDayId: attempt.examDayId, stationNumber: stationNum } } });
    if (!stationCase) return res.status(404).json({ error: "Station tidak ditemukan." });
    const answerText = typeof req.body?.answerText === "string" ? req.body.answerText.slice(0, 12000) : "";
    const submission = await prisma.stationSubmission.upsert({
      where: { attemptId_stationCaseId: { attemptId: attempt.id, stationCaseId: stationCase.id } },
      create: { attemptId: attempt.id, stationCaseId: stationCase.id, formAnswersJson: { answerText }, accStatus: stationCase.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED },
      update: { formAnswersJson: { answerText } },
    });
    return res.json({ saved: true, savedAt: new Date().toISOString(), submissionId: submission.id });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/submissions/:submissionId/events", authRequired, async (req, res, next) => {
  try {
    const submissionId = Number(req.params.submissionId);
    const { eventCode, payload } = req.body || {};
    if (!eventCode || typeof eventCode !== "string") return res.status(400).json({ error: "eventCode wajib diisi." });
    const submission = await prisma.stationSubmission.findFirst({ where: { id: submissionId, attempt: { userId: Number(req.auth.sub) } } });
    if (!submission) return res.status(404).json({ error: "Submission tidak ditemukan." });
    await prisma.actionLog.create({ data: { submissionId, eventCode: eventCode.slice(0, 80), payloadJson: payload || undefined } });
    return res.status(201).json({ recorded: true, submissionId, eventCode });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/submissions/:submissionId/npc-talk", authRequired, async (req, res, next) => {
  try {
    const submissionId = Number(req.params.submissionId);
    if (typeof req.body?.spokenText !== "string" || !req.body.spokenText.trim()) return res.status(400).json({ error: "spokenText wajib diisi." });
    const text = req.body.spokenText.toLowerCase();
    const submission = await prisma.stationSubmission.findFirst({
      where: { id: submissionId, attempt: { userId: Number(req.auth.sub) } }, include: { stationCase: { include: { npcDialogs: true } } },
    });
    if (!submission) return res.status(404).json({ error: "Submission tidak ditemukan." });
    const matched = submission.stationCase.npcDialogs.find((node) => node.triggerKeywords.some((keyword) => text.includes(keyword.toLowerCase())));
    const fallback = submission.stationCase.npcDialogs.find((node) => !node.isHiddenClue);
    const dialog = matched || fallback;
    if (!dialog) return res.status(404).json({ error: "Dialog NPC belum dikonfigurasi untuk soal ini." });
    const clues = matched?.isHiddenClue && dialog.clueKey ? Array.from(new Set([...submission.unlockedClues, dialog.clueKey])) : submission.unlockedClues;
    if (clues.length !== submission.unlockedClues.length) {
      await prisma.stationSubmission.update({ where: { id: submissionId }, data: { unlockedClues: clues } });
    }
    await prisma.audioTranscript.create({ data: { submissionId, spokenText: req.body.spokenText, matchedClue: matched?.clueKey || null, npcReplyText: dialog.responseText } });
    return res.json({ matched: Boolean(matched), unlockedClue: matched?.clueKey || null, replyText: dialog.responseText, npcAnim: dialog.npcAnim, commScoreDelta: matched?.rubricCode ? 15 : 0 });
  } catch (error) {
    return next(error);
  }
});

async function processExpiredTimers() {
  const expired = await prisma.examAttempt.findMany({ where: { finishedAt: null, phaseEndsAt: { lte: new Date() } }, select: { id: true } });
  for (const { id } of expired) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const attempt = await tx.examAttempt.findUnique({ where: { id }, include: { examDay: true } });
        if (!attempt || attempt.finishedAt || !attempt.phaseEndsAt || attempt.phaseEndsAt > new Date()) return null;
        const stationCase = await tx.stationCase.findUnique({ where: { examDayId_stationNumber: { examDayId: attempt.examDayId, stationNumber: attempt.currentStation } } });
        if (!stationCase) return null;
        const durations = durationsFor(stationCase);
        let nextPhase = attempt.currentPhase;
        let nextStation = attempt.currentStation;
        let finishedAt = null;
        let deadline;

        if (attempt.currentPhase === TimerPhase.READ) {
          nextPhase = TimerPhase.WORK;
          deadline = new Date(Date.now() + phaseLength(nextPhase, durations) * 1000);
        } else if (attempt.currentPhase === TimerPhase.WORK) {
          nextPhase = TimerPhase.MOVE;
          deadline = new Date(Date.now() + phaseLength(nextPhase, durations) * 1000);
        } else if (attempt.currentPhase === TimerPhase.MOVE && attempt.currentStation === 10) {
          await tx.stationSubmission.upsert({
            where: { attemptId_stationCaseId: { attemptId: attempt.id, stationCaseId: stationCase.id } },
            create: { attemptId: attempt.id, stationCaseId: stationCase.id, submittedAt: new Date(), accStatus: stationCase.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED },
            update: { submittedAt: new Date() },
          });
          nextPhase = TimerPhase.FINISHED;
          deadline = null;
          finishedAt = new Date();
        } else {
          await tx.stationSubmission.upsert({
            where: { attemptId_stationCaseId: { attemptId: attempt.id, stationCaseId: stationCase.id } },
            create: { attemptId: attempt.id, stationCaseId: stationCase.id, submittedAt: new Date(), accStatus: stationCase.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED },
            update: { submittedAt: new Date() },
          });
          nextStation += 1;
          nextPhase = TimerPhase.READ;
          const nextCase = await tx.stationCase.findUnique({ where: { examDayId_stationNumber: { examDayId: attempt.examDayId, stationNumber: nextStation } } });
          if (!nextCase) return null;
          await tx.stationSubmission.upsert({
            where: { attemptId_stationCaseId: { attemptId: attempt.id, stationCaseId: nextCase.id } },
            create: { attemptId: attempt.id, stationCaseId: nextCase.id, accStatus: nextCase.requiresAccStage ? AccStatus.PENDING : AccStatus.NOT_REQUIRED },
            update: {},
          });
          deadline = new Date(Date.now() + durationsFor(nextCase).read * 1000);
        }
        const updated = await tx.examAttempt.update({
          where: { id: attempt.id },
          data: { currentStation: nextStation, currentPhase: nextPhase, phaseEndsAt: deadline, finishedAt },
          include: { examDay: true },
        });
        return attemptState(updated);
      });
      if (result) {
        io.to(`attempt:${id}`).emit("timer:update", result);
        if (result.finishedAt) io.to(`attempt:${id}`).emit("timer:finished", result);
      }
    } catch (error) {
      console.error(`[TIMER] Gagal memproses attempt ${id}:`, error.message);
    }
  }
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    socket.user = jwt.verify(token, appSecret);
    return next();
  } catch {
    return next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("attempt:join", async ({ attemptId } = {}) => {
    const attempt = await findOwnedAttempt(attemptId, Number(socket.user.sub));
    if (!attempt) return socket.emit("attempt:error", { error: "Sesi ujian tidak ditemukan." });
    socket.join(`attempt:${attempt.id}`);
    socket.emit("timer:update", attemptState(attempt));
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "P2021" || error.code === "P1001") return res.status(503).json({ error: "Database belum siap. Pastikan PostgreSQL berjalan dan migrasi Prisma sudah diterapkan." });
  return res.status(500).json({ error: "Terjadi kesalahan pada server." });
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`OSCE Backend aktif di http://localhost:${PORT} (FAST_TIMER=${fastTimer})`);
});

let timerBusy = false;
const timerLoop = setInterval(async () => {
  if (timerBusy) return;
  timerBusy = true;
  try {
    await processExpiredTimers();
    const activeAttempts = await prisma.examAttempt.findMany({
      where: { finishedAt: null, phaseEndsAt: { not: null } }, include: { examDay: true },
    });
    for (const attempt of activeAttempts) io.to(`attempt:${attempt.id}`).emit("timer:update", attemptState(attempt));
  } catch (error) {
    console.error("[TIMER]", error.message);
  } finally {
    timerBusy = false;
  }
}, 1000);

async function shutdown() {
  clearInterval(timerLoop);
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
