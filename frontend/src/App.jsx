import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  registerGodotListener,
  sendStationToGodot,
  triggerGodotNpcAnim,
} from "./godotBridge";

const API_BASE = "http://localhost:4000";

export default function App() {
  const [stationNum, setStationNum] = useState(3);
  const [bundle, setBundle] = useState(null);
  const [timer, setTimer] = useState({ phase: "READY", remainingSec: 0 });
  const [spokenText, setSpokenText] = useState("");
  const [npcReply, setNpcReply] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isListening, setIsListening] = useState(false);

  const addLog = (msg) =>
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  useEffect(() => {
    // 1. Daftarkan jembatan Godot -> Web
    registerGodotListener(async (eventCode, payload) => {
      addLog(`Godot Event diterima: ${eventCode}`);
      const res = await fetch(`${API_BASE}/api/submissions/1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventCode, payload }),
      });
      const data = await res.json();
      addLog(`Backend mencatat ${eventCode} (+${data.xpDelta} XP)`);
    });

    // 2. Koneksi WebSocket Timer 3 Fase (Devana)
    const socket = io(API_BASE);
    socket.on("timer:tick", (tick) => setTimer(tick));
    socket.on("timer:station_done", ({ stationNumber }) => {
      addLog(`Station ${stationNumber} selesai! Auto-save & pindah station.`);
    });

    window._osceSocket = socket;
    return () => socket.disconnect();
  }, []);

  // Load Station Bundle dari Backend (Devana) lalu kirim ke Godot
  const handleLoadStation = async (num) => {
    setStationNum(num);
    const res = await fetch(`${API_BASE}/api/attempts/1/station/${num}/bundle`);
    const data = await res.json();
    setBundle(data);
    sendStationToGodot(data);
    addLog(`Station ${num} (${data.template.code}) dimuat.`);
    window._osceSocket?.emit("timer:start", { stationNumber: num });
  };

  // Tes Mikrofon Browser (Web Speech API Bahasa Indonesia — Azzahra)
  const handleMicTalk = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Browser tidak mendukung Web Speech API. Gunakan Google Chrome / Edge.");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "id-ID";
    rec.interimResults = false;
    setIsListening(true);

    rec.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setSpokenText(text);
      setIsListening(false);
      await sendSpeechToBackend(text);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const sendSpeechToBackend = async (text) => {
    if (!text.trim()) return;
    addLog(`Peserta berkata: "${text}"`);
    const res = await fetch(`${API_BASE}/api/submissions/1/npc-talk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spokenText: text }),
    });
    const data = await res.json();
    setNpcReply(data);
    triggerGodotNpcAnim(data.npcAnim);
    if (data.unlockedClue) {
      addLog(`CLUE TERBUKA: ${data.unlockedClue} (+${data.commScoreDelta} poin komunikasi)`);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "24px auto", padding: 20 }}>
      <h1 style={{ margin: "0 0 6px", color: "#1e3a8a" }}>
        OSCE Apoteker 3D Simulator — Starter Minggu 1
      </h1>
      <p style={{ margin: "0 0 20px", color: "#475569" }}>
        Demo integrasi <b>Devana</b> (Timer 3 Fase &amp; Station Bundle) +{" "}
        <b>Azzahra</b> (Mikrofon STT &amp; Jembatan Godot)
      </p>

      {/* Panel Kontrol Station & Timer */}
      <div style={cardStyle}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnPrimary} onClick={() => handleLoadStation(3)}>
            Muat Station 3 (T6 Swamedikasi + Mic)
          </button>
          <button style={btnWarn} onClick={() => handleLoadStation(5)}>
            Muat Station 5 (T10 Ruang Istirahat)
          </button>
          <button
            style={btnSecondary}
            onClick={() => window.onGodotEvent("WASH_HANDS", { source: "simulasi_klik" })}
          >
            Simulasi Klik 3D Godot: Cuci Tangan
          </button>
          <div style={{ marginLeft: "auto", fontWeight: 700, fontSize: 16 }}>
            Fase: <span style={{ color: "#2563eb" }}>{timer.phase}</span> | Sisa:{" "}
            {timer.remainingSec} dtk
          </div>
        </div>

        {bundle && (
          <div style={{ marginTop: 12, padding: 10, background: "#f1f5f9", borderRadius: 6 }}>
            <b>Template:</b> {bundle.template.code} ({bundle.template.scenePath}) |{" "}
            <b>Mic Aktif:</b> {bundle.hasMicrophone ? "YA" : "TIDAK"}
            <div style={{ marginTop: 4 }}>{bundle.doorInstruction}</div>
          </div>
        )}
      </div>

      {/* Panel Tes Mikrofon & Clue Tersembunyi NPC */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Tes Mikrofon &amp; Clue Tersembunyi NPC (Azzahra)</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnPrimary} onClick={handleMicTalk} disabled={isListening}>
            {isListening ? "Mendengarkan..." : "Tekan & Bicara (Mic id-ID)"}
          </button>
          <input
            value={spokenText}
            onChange={(e) => setSpokenText(e.target.value)}
            placeholder='Fallback ketik, misal: "Apakah ibu sedang hamil atau alergi?"'
            style={{ flex: 1, minWidth: 260, padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <button style={btnSecondary} onClick={() => sendSpeechToBackend(spokenText)}>
            Kirim Teks
          </button>
        </div>

        {npcReply && (
          <div style={{ marginTop: 12, padding: 12, background: "#ecfdf5", borderRadius: 6, border: "1px solid #10b981" }}>
            <b>Respon NPC ({npcReply.npcAnim}):</b> {npcReply.replyText}
            {npcReply.unlockedClue && (
              <div style={{ marginTop: 6, color: "#047857", fontWeight: 700 }}>
                Clue Terbuka: {npcReply.unlockedClue}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Event */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Log Integrasi Real-Time</h3>
        <div style={{ fontFamily: "monospace", fontSize: 12, maxHeight: 180, overflowY: "auto" }}>
          {logs.length === 0 ? "Belum ada log. Klik salah satu tombol di atas." : logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  padding: 16,
  borderRadius: 10,
  marginBottom: 16,
  boxShadow: "0 2px 8px rgba(15,23,42,0.06)",
};
const btnPrimary = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "9px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
};
const btnWarn = { ...btnPrimary, background: "#d97706" };
const btnSecondary = { ...btnPrimary, background: "#334155" };
