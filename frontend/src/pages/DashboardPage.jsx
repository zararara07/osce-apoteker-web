import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function DashboardPage({ token, user, onStartAttempt, onLogout }) {
  const [examDays, setExamDays] = useState([]);
  const [loadingDay, setLoadingDay] = useState(null);
  const [micStatus, setMicStatus] = useState("Belum dites");
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/api/exam-days", { token })
      .then((res) => setExamDays(res.examDays || []))
      .catch((err) => setError(err.message));
  }, [token]);

  const handleTestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus("Siap dipakai (Izin Mikrofon Aktif)");
    } catch {
      setMicStatus("Gagal / Diblokir (Gunakan Chrome/Edge & izinkan mic)");
    }
  };

  const handleStart = async (dayNumber) => {
    setLoadingDay(dayNumber);
    setError("");
    try {
      const data = await apiRequest("/api/attempts/start", {
        method: "POST",
        token,
        body: { dayNumber },
      });
      onStartAttempt(data.attempt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDay(null);
    }
  };

  const xpProgress = user.totalXp % 200;

  return (
    <div>
      <header className="topbar">
        <div className="topbar-brand">
          <span>OSCE Apoteker 3D Simulator</span>
          <span className="pill pill-blue">{user.role}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13 }}>
            <b>{user.name}</b> ({user.nimOrNip})
          </span>
          <button className="btn btn-outline" style={{ padding: "6px 12px" }} onClick={onLogout}>
            Keluar
          </button>
        </div>
      </header>

      <main className="container">
        {error && <div className="error-box">{error}</div>}

        {/* Profil Gamifikasi & Tes Mikrofon */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>Progres Gamifikasi Apoteker</h3>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  Level {user.level} • Total {user.totalXp} XP
                </span>
              </div>
              <span className="pill pill-purple">Level {user.level}</span>
            </div>
            <div className="bar-track" style={{ marginTop: 10 }}>
              <div className="bar-fill" style={{ width: `${(xpProgress / 200) * 100}%` }} />
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(user.badges || []).map((b) => (
                <span key={b} className="pill pill-green">Badge: {b}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 6px" }}>Cek Kesiapan Mikrofon</h3>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#475569" }}>
              Station pelayanan interaktif (T6, T7, T9) memakai mikrofon untuk berbicara dengan NPC.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span className="pill pill-slate">{micStatus}</span>
              <button className="btn btn-dark" onClick={handleTestMic}>
                Tes Mikrofon
              </button>
            </div>
          </div>
        </div>

        {/* Pilihan 3 Paket Ujian (Day 1, Day 2, Day 3) */}
        <h2 style={{ margin: "24px 0 4px" }}>Pilih Paket Simulasi OSCE (10 Station)</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          Setiap paket menggunakan <b>10 Template Ruangan Godot</b> yang sama dengan data kasus berbeda sesuai Lampiran F. Station 5 selalu menjadi <b>Ruang Istirahat</b>.
        </p>

        <div className="day-grid">
          {examDays.map((day) => (
            <div key={day.dayNumber} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, color: "#1e3a8a" }}>{day.title}</h3>
                <span className="pill pill-blue">10 Station</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>{day.subtitle}</p>

              <ul className="station-mini-list" style={{ flex: 1 }}>
                {day.stations.map((s) => (
                  <li key={s.stationNumber}>
                    <span>
                      <b>S{s.stationNumber}</b> ({s.templateCode}): {s.title}
                    </span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {s.isRestStation && <span className="pill pill-amber">Istirahat</span>}
                      {s.hasMicrophone && <span className="pill pill-purple">Mic</span>}
                      {s.requiresAccStage && <span className="pill pill-green">ACC</span>}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className="btn btn-primary"
                onClick={() => handleStart(day.dayNumber)}
                disabled={loadingDay === day.dayNumber}
              >
                {loadingDay === day.dayNumber ? "Menyiapkan Station 1..." : `Mulai ${day.title}`}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
