import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

const COMP_LABELS = {
  PENGUMPULAN_DATA: "1. Pengumpulan Data & Informasi",
  PENETAPAN_MASALAH: "2. Penetapan Masalah",
  PENYELESAIAN_MASALAH: "3. Penyelesaian Masalah",
  PENCATATAN_PELAPORAN: "4. Pencatatan & Pelaporan",
  KOMUNIKASI_EFEKTIF: "5. Komunikasi Efektif",
  SIKAP_PROFESIONAL: "6. Sikap & Perilaku Profesional",
};

export default function ReportPage({ token, attemptId, onBackDashboard }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/api/attempts/${attemptId}/report`, { token })
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [attemptId, token]);

  if (error) return <div className="container"><div className="error-box">{error}</div></div>;
  if (!report) return <div className="container">Menyiapkan Rapor OSCE...</div>;

  return (
    <div>
      <header className="topbar">
        <div className="topbar-brand">Rapor Evaluasi OSCE UKMPPAI — {report.dayTitle}</div>
        <button className="btn btn-primary" onClick={onBackDashboard}>
          Kembali ke Dashboard
        </button>
      </header>

      <main className="container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
          <div className="card">
            <div style={{ fontSize: 12, color: "#64748b" }}>Skor Rata-Rata OSCE</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#1e3a8a" }}>{report.totalScore} / 100</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "#64748b" }}>XP Diperoleh Putaran Ini</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#16a34a" }}>+{report.earnedXp} XP</div>
          </div>
          <div className="card">
            <div style={{ fontSize: 12, color: "#64748b" }}>Level &amp; Badge Saat Ini</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#7e22ce" }}>Level {report.user.level}</div>
            <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {report.user.badges.map((b) => (
                <span key={b} className="pill pill-green">{b}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 6 Kompetensi UKAI */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>Rincian 6 Kompetensi UKAI OSCE</h3>
          {Object.entries(report.competencySummary).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
                <span>{COMP_LABELS[key] || key}</span>
                <span>{val} / 100</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${val}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Rincian 10 Station */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Hasil Per Station (1 s.d. 10)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 8 }}>Station</th>
                <th style={{ padding: 8 }}>Template</th>
                <th style={{ padding: 8 }}>Kasus</th>
                <th style={{ padding: 8 }}>Aksi 3D / Clue Mic</th>
                <th style={{ padding: 8 }}>Skor</th>
              </tr>
            </thead>
            <tbody>
              {report.stationReports.map((s) => (
                <tr key={s.stationNumber} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 8 }}><b>S{s.stationNumber}</b></td>
                  <td style={{ padding: 8 }}><span className="pill pill-slate">{s.templateCode}</span></td>
                  <td style={{ padding: 8 }}>{s.title}</td>
                  <td style={{ padding: 8 }}>
                    {s.isRestStation ? (
                      <span className="pill pill-amber">Ruang Istirahat</span>
                    ) : (
                      <span>
                        {s.eventsCount} aksi 3D
                        {s.hasMicrophone ? ` • ${s.unlockedClues.length} clue mic` : ""}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 8 }}>
                    <b>{s.isRestStation ? "-" : s.stationScore}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
