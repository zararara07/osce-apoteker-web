import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE, apiRequest } from "../api";
import {
  registerGodotListener,
  sendStationToGodot,
  triggerGodotNpcAnim,
} from "../godotBridge";

const CONDITION_BADGE = {
  GOOD: { label: "BAIK", cls: "pill-green" },
  DAMAGED: { label: "RUSAK", cls: "pill-red" },
  LEAKING: { label: "BOCOR", cls: "pill-red" },
  EXPIRED: { label: "KEDALUWARSA (ED)", cls: "pill-amber" },
  BROKEN_SEAL: { label: "SEGEL RUSAK", cls: "pill-amber" },
  PRECIPITATE: { label: "ENDAPAN", cls: "pill-amber" },
};

function formatTime(sec) {
  const s = Math.max(0, Number(sec || 0));
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export default function SimulationPage({ token, attempt, onFinishAttempt, onExit }) {
  const [stationNum, setStationNum] = useState(attempt.currentStation || 1);
  const [bundle, setBundle] = useState(null);
  const [timer, setTimer] = useState({ phase: "READ", remainingSec: 0 });
  const [activeTab, setActiveTab] = useState("worksheet");
  const [attemptXp, setAttemptXp] = useState(attempt.earnedXp || 0);

  // State Worksheet & ACC Penguji (Template 1)
  const [formAnswers, setFormAnswers] = useState({
    identifikasiMasalah: "",
    perhitunganAtauSolusi: "",
    dokumentasiCatatan: "",
    worksheet2UmurSimpan: "",
  });
  const [accStatus, setAccStatus] = useState("NOT_REQUIRED");

  // State Mikrofon & Chat NPC
  const [chatHistory, setChatHistory] = useState([]);
  const [unlockedClues, setUnlockedClues] = useState([]);
  const [spokenInput, setSpokenInput] = useState("");
  const [isListening, setIsListening] = useState(false);

  // Event log interaksi 3D Godot
  const [doneEvents, setDoneEvents] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const socketRef = useRef(null);
  const stationNumRef = useRef(stationNum);
  stationNumRef.current = stationNum;

  // Koneksi WebSocket Timer 3 Fase
  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;
    socket.on("timer:tick", (tick) => setTimer(tick));
    socket.on("timer:station_done", () => {
      setStatusMsg("Waktu station habis! Mengirim jawaban otomatis...");
      handleSubmitStation(true);
    });
    return () => socket.disconnect();
  }, []);

  // Load bundle setiap kali stationNum berubah
  useEffect(() => {
    let cancelled = false;
    setStatusMsg("");
    setFormAnswers({
      identifikasiMasalah: "",
      perhitunganAtauSolusi: "",
      dokumentasiCatatan: "",
      worksheet2UmurSimpan: "",
    });
    setChatHistory([]);
    setUnlockedClues([]);
    setDoneEvents([]);

    apiRequest(`/api/attempts/${attempt.id}/station/${stationNum}/bundle`, { token })
      .then((data) => {
        if (cancelled) return;
        setBundle(data);
        setAccStatus(data.submissionState?.accStatus || "NOT_REQUIRED");
        setActiveTab(data.hasMicrophone ? "mic" : "worksheet");
        sendStationToGodot(data);
        socketRef.current?.emit("timer:start", {
          stationNumber: data.stationNumber,
          isRestStation: data.isRestStation,
        });
      })
      .catch((err) => setStatusMsg(`Gagal memuat station: ${err.message}`));

    // Daftarkan bridge Godot -> Web untuk station aktif
    registerGodotListener((eventCode, payload) => {
      record3dEvent(eventCode, payload);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt.id, stationNum, token]);

  const record3dEvent = async (eventCode, payload = {}) => {
    try {
      const data = await apiRequest(
        `/api/attempts/${attempt.id}/station/${stationNumRef.current}/events`,
        { method: "POST", token, body: { eventCode, payload } }
      );
      setDoneEvents((prev) => (prev.includes(eventCode) ? prev : [...prev, eventCode]));
      setAttemptXp(data.totalAttemptXp);
      if (data.xpDelta > 0) {
        setStatusMsg(`Aksi 3D tercatat: ${eventCode} (+${data.xpDelta} XP)`);
      }
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleRequestAcc = async () => {
    try {
      const data = await apiRequest(
        `/api/attempts/${attempt.id}/station/${stationNum}/acc`,
        { method: "POST", token, body: { worksheet1: formAnswers } }
      );
      setAccStatus(data.accStatus);
      setAttemptXp((prev) => prev + data.xpDelta);
      triggerGodotNpcAnim("APPROVE_ACC");
      setStatusMsg(data.message);
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleMicTalk = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setStatusMsg("Browser tidak mendukung Web Speech API. Gunakan Chrome/Edge atau ketik manual.");
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "id-ID";
    rec.interimResults = false;
    setIsListening(true);
    rec.onresult = async (ev) => {
      const text = ev.results[0][0].transcript;
      setIsListening(false);
      await sendNpcTalk(text);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  const sendNpcTalk = async (text) => {
    if (!text.trim()) return;
    setSpokenInput("");
    try {
      const data = await apiRequest(
        `/api/attempts/${attempt.id}/station/${stationNum}/npc-talk`,
        { method: "POST", token, body: { spokenText: text } }
      );
      setChatHistory((prev) => [
        ...prev,
        { sender: "Peserta", text },
        { sender: "NPC", text: data.replyText, clue: data.unlockedClue },
      ]);
      setUnlockedClues(data.allUnlockedClues || []);
      setAttemptXp(data.totalAttemptXp);
      triggerGodotNpcAnim(data.npcAnim);
    } catch (err) {
      setStatusMsg(err.message);
    }
  };

  const handleSubmitStation = async (isAuto = false) => {
    if (submitting) return;
    setSubmitting(true);
    socketRef.current?.emit("timer:stop");
    try {
      const data = await apiRequest(
        `/api/attempts/${attempt.id}/station/${stationNumRef.current}/submit`,
        { method: "POST", token, body: { formAnswers, isAuto } }
      );
      if (data.finished) {
        onFinishAttempt(attempt.id, data.user);
      } else {
        setAttemptXp(data.totalAttemptXp);
        setStationNum(data.nextStation);
      }
    } catch (err) {
      setStatusMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!bundle) {
    return <div className="container">Memuat Station {stationNum}...</div>;
  }

  return (
    <div>
      {/* TOP HUD BAR */}
      <div className="hud-bar">
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            Day {attempt.dayNumber} • Station {stationNum}/10 • {bundle.template.code} ({bundle.template.name})
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{bundle.title}</div>
        </div>

        {/* Progress 10 Station */}
        <div className="station-dots">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            let cls = "dot";
            if (n === 5) cls += " rest";
            if (n < stationNum) cls += " done";
            if (n === stationNum) cls += " active";
            return (
              <div key={n} className={cls} title={n === 5 ? "Station 5: Istirahat" : `Station ${n}`}>
                {n === 5 ? "R" : n}
              </div>
            );
          })}
        </div>

        {/* Timer 3 Fase & XP */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pill pill-purple">XP: {attemptXp}</span>
          <span className={`pill ${timer.phase === "READ" ? "pill-amber" : timer.phase === "WORK" ? "pill-green" : "pill-blue"}`}>
            FASE {timer.phase}: {formatTime(timer.remainingSec)}
          </span>
          <button
            className="btn btn-success"
            style={{ padding: "7px 14px" }}
            onClick={() => handleSubmitStation(false)}
            disabled={submitting}
          >
            {stationNum === 10 ? "Selesai & Lihat Rapor" : "Submit & Lanjut →"}
          </button>
          <button className="btn btn-outline" style={{ padding: "7px 10px" }} onClick={onExit}>
            Keluar
          </button>
        </div>
      </div>

      {/* MAIN SIMULATION WORKSPACE */}
      <div className="sim-layout">
        {/* KIRI: GODOT 3D VIEWPORT */}
        <div className="godot-viewport">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="pill pill-blue">Godot 4.3 WebGL Viewport • {bundle.template.scenePath}</span>
              {bundle.hasMicrophone && <span className="pill pill-purple">Station Bermikrofon</span>}
              {bundle.isRestStation && <span className="pill pill-amber">Template 10: Ruang Istirahat</span>}
            </div>

            <div style={{ background: "rgba(255,255,255,0.08)", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700, marginBottom: 4 }}>
                KERTAS INSTRUKSI DI DEPAN PINTU (FASE 1 — BACA SOAL):
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{bundle.doorInstruction}</div>
            </div>

            {bundle.isRestStation ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "rgba(217,119,6,0.15)", borderRadius: 10 }}>
                <h2 style={{ margin: "0 0 8px", color: "#fcd34d" }}>Ruang Istirahat (Station 5)</h2>
                <p style={{ margin: 0, color: "#e2e8f0" }}>
                  Tidak ada soal pada station ini. Anda sudah menyelesaikan Station 1–4. Klik <b>Submit &amp; Lanjut</b> kapan saja untuk menuju Station 6.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 8 }}>
                  Simulasi Interaksi Objek 3D Godot (Klik tombol di bawah untuk menguji <code>godotBridge → Backend Events</code> sebelum export `.wasm` Godot ditanam):
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(bundle.interactiveActions || []).map((act) => {
                    const done = doneEvents.includes(act);
                    return (
                      <button
                        key={act}
                        className={`btn ${done ? "btn-success" : "btn-outline"}`}
                        onClick={() => record3dEvent(act, { source: "viewport_sim" })}
                      >
                        {done ? `✓ ${act}` : `Klik 3D: ${act}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, fontSize: 12, color: "#94a3b8", borderTop: "1px solid #334155", paddingTop: 10 }}>
            {statusMsg || "Tip: Saat Tim 3D sudah mengekspor Web Godot, <iframe/canvas> Godot diletakkan di area gelap ini."}
          </div>
        </div>

        {/* KANAN: PANEL WORKSHEET, MIKROFON NPC & REFERENSI */}
        <div className="card">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === "worksheet" ? "active" : ""}`}
              onClick={() => setActiveTab("worksheet")}
            >
              Worksheet / Form
            </button>
            {bundle.hasMicrophone && (
              <button
                className={`tab-btn ${activeTab === "mic" ? "active" : ""}`}
                onClick={() => setActiveTab("mic")}
              >
                Mikrofon NPC ({unlockedClues.length} Clue)
              </button>
            )}
            <button
              className={`tab-btn ${activeTab === "ref" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("ref");
                record3dEvent("OPEN_REFERENCE", { station: stationNum });
              }}
            >
              Obat &amp; Referensi ({bundle.items.length + bundle.allowedReferences.length})
            </button>
          </div>

          {/* TAB 1: WORKSHEET / FORM */}
          {activeTab === "worksheet" && (
            <div>
              {bundle.isRestStation ? (
                <p style={{ fontSize: 13.5, color: "#475569" }}>Tidak ada form untuk diisi di Ruang Istirahat.</p>
              ) : (
                <>
                  <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {bundle.forms.map((f) => (
                      <span key={f} className="pill pill-slate">{f}</span>
                    ))}
                  </div>

                  <label className="label">1. Identifikasi Masalah / Data Pasien / Produk &amp; Batch</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formAnswers.identifikasiMasalah}
                    onChange={(e) => setFormAnswers({ ...formAnswers, identifikasiMasalah: e.target.value })}
                    placeholder="Tulis temuan DRP, obat rusak/ED, atau identitas produk..."
                  />

                  <label className="label">2. Perhitungan / Solusi / Pilihan Obat &amp; Rekomendasi</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={formAnswers.perhitunganAtauSolusi}
                    onChange={(e) => setFormAnswers({ ...formAnswers, perhitunganAtauSolusi: e.target.value })}
                    placeholder="Tulis hasil hitungan (RKO/ROP/HPLC/LOD/dosis) atau rekomendasi terapi..."
                  />

                  {/* KHUSUS TEMPLATE 1: ALUR BERTAHAP ACC PENGUJI */}
                  {bundle.requiresAccStage && (
                    <div style={{ padding: 12, background: "#fef3c7", borderRadius: 8, marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                        Alur Bertahap Studi Stabilitas (Status ACC: {accStatus})
                      </div>
                      {accStatus !== "APPROVED" ? (
                        <button className="btn btn-warn" onClick={handleRequestAcc}>
                          Ajukan Worksheet 1 untuk ACC Penguji
                        </button>
                      ) : (
                        <>
                          <label className="label" style={{ marginTop: 6 }}>
                            Worksheet 2 (Terbuka setelah ACC): Perkiraan Umur Simpan &amp; ED
                          </label>
                          <input
                            className="input"
                            value={formAnswers.worksheet2UmurSimpan}
                            onChange={(e) => setFormAnswers({ ...formAnswers, worksheet2UmurSimpan: e.target.value })}
                            placeholder="Contoh: Kondisi 30°C/75% RH, umur simpan 24 bulan"
                          />
                        </>
                      )}
                    </div>
                  )}

                  <label className="label">3. Pencatatan / Etiket / Berita Acara / PIO</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formAnswers.dokumentasiCatatan}
                    onChange={(e) => setFormAnswers({ ...formAnswers, dokumentasiCatatan: e.target.value })}
                    placeholder="Aturan pakai, BUD, saksi pemusnahan, atau edukasi pasien..."
                  />
                </>
              )}
            </div>
          )}

          {/* TAB 2: MIKROFON & DIALOG CLUE NPC */}
          {activeTab === "mic" && bundle.hasMicrophone && (
            <div>
              <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {unlockedClues.length === 0 ? (
                  <span className="pill pill-amber">Clue Tersembunyi: Belum ada yang digali</span>
                ) : (
                  unlockedClues.map((c) => (
                    <span key={c} className="pill pill-green">✓ Terbuka: {c}</span>
                  ))
                )}
              </div>

              <div className="chat-box">
                {chatHistory.length === 0 ? (
                  <div style={{ color: "#64748b" }}>
                    Mulai berbicara dengan NPC lewat mikrofon (misal tanyakan keluhan, alergi, kehamilan, atau obat rutin lain).
                  </div>
                ) : (
                  chatHistory.map((m, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <b>{m.sender}:</b> {m.text}
                      {m.clue && <span className="pill pill-green" style={{ marginLeft: 6 }}>{m.clue}</span>}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-primary" onClick={handleMicTalk} disabled={isListening}>
                  {isListening ? "Mendengarkan..." : "🎤 Bicara"}
                </button>
                <input
                  className="input"
                  style={{ marginBottom: 0, flex: 1 }}
                  value={spokenInput}
                  onChange={(e) => setSpokenInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendNpcTalk(spokenInput)}
                  placeholder="Atau ketik pertanyaan ke NPC..."
                />
                <button className="btn btn-dark" onClick={() => sendNpcTalk(spokenInput)}>
                  Kirim
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DAFTAR OBAT (KONDISI VISUAL) & REFERENSI */}
          {activeTab === "ref" && (
            <div>
              <h4 style={{ margin: "0 0 8px" }}>Objek Obat di Ruangan (Data-Driven)</h4>
              {bundle.items.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#64748b" }}>Tidak ada objek obat khusus pada station ini.</p>
              ) : (
                bundle.items.map((item, idx) => {
                  const badge = CONDITION_BADGE[item.condition] || CONDITION_BADGE.GOOD;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        marginBottom: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b" }}>
                          Slot: {item.slotId} • Golongan: {item.drugClass} {item.expDate ? `• ED: ${item.expDate}` : ""}
                        </div>
                      </div>
                      <span className={`pill ${badge.cls}`}>{badge.label}</span>
                    </div>
                  );
                })
              )}

              <h4 style={{ margin: "14px 0 8px" }}>Buku Referensi Diizinkan (Lampiran D)</h4>
              {bundle.allowedReferences.map((ref) => (
                <div key={ref.code} style={{ padding: 10, background: "#f8fafc", borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{ref.title}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{ref.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
