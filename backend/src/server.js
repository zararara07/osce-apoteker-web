require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const { authRouter } = require("./routes/auth");
const { attemptsRouter } = require("./routes/attempts");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const FAST_TIMER = process.env.FAST_TIMER === "true";

// Root & Health Check
app.get("/", (req, res) => {
  res.json({
    message: "OSCE Apoteker UKMPPAI Backend berjalan normal!",
    fastTimerMode: FAST_TIMER,
    endpoints: {
      health: "GET /api/health",
      login: "POST /api/auth/login",
      register: "POST /api/auth/register",
      examDays: "GET /api/exam-days",
      startAttempt: "POST /api/attempts/start",
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

// Modular Routes (Devana & Azzahra)
app.use("/api/auth", authRouter);
app.use("/api", attemptsRouter);

// WebSocket Timer 3 Fase (READ -> WORK -> MOVE)
io.on("connection", (socket) => {
  let activeInterval = null;

  const stopTimer = () => {
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
  };

  socket.on("timer:start", ({ stationNumber = 1, isRestStation = false }) => {
    stopTimer();
    const phases = isRestStation
      ? [
          { phase: "REST", sec: FAST_TIMER ? 15 : 600 },
          { phase: "MOVE", sec: FAST_TIMER ? 5 : 60 },
        ]
      : [
          { phase: "READ", sec: FAST_TIMER ? 8 : 60 },
          { phase: "WORK", sec: FAST_TIMER ? 60 : 540 },
          { phase: "MOVE", sec: FAST_TIMER ? 5 : 60 },
        ];

    let idx = 0;
    let remaining = phases[0].sec;

    const emitTick = () => {
      socket.emit("timer:tick", {
        stationNumber,
        phase: phases[idx].phase,
        remainingSec: remaining,
      });
    };

    emitTick();
    activeInterval = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) {
        idx += 1;
        if (idx >= phases.length) {
          stopTimer();
          socket.emit("timer:station_done", { stationNumber });
          return;
        }
        remaining = phases[idx].sec;
      }
      emitTick();
    }, 1000);
  });

  socket.on("timer:stop", stopTimer);
  socket.on("disconnect", stopTimer);
});

server.listen(PORT, () => {
  console.log(`OSCE Backend aktif di http://localhost:${PORT} (FAST_TIMER=${FAST_TIMER})`);
});
