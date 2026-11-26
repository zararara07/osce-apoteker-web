import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE, api, clearToken, getToken, saveToken } from "./api";
import { registerGodotListener, sendStationToGodot } from "./godotBridge";
import "./styles.css";

const ATTEMPT_KEY = "osce_current_attempt";

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [attempt, setAttempt] = useState(null);
  const [report, setReport] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        if (mounted) setBooting(false);
        return;
      }
      try {
        const { user: currentUser } = await api("/api/auth/me");
        if (!mounted) return;
        setUser(currentUser);
        const savedAttemptId = localStorage.getItem(ATTEMPT_KEY);
        if (savedAttemptId) {
          try {
            const result = await api(`/api/attempts/${savedAttemptId}`);
            if (!mounted) return;
            setAttempt(result);
            if (result.attempt.finishedAt) {
              const finalReport = await api(`/api/attempts/${savedAttemptId}/report`);
              if (mounted) {
                setReport(finalReport);
                setView("report");
              }
            } else {
              setView("exam");
            }
          } catch {
            localStorage.removeItem(ATTEMPT_KEY);
            setView("dashboard");
          }
        } else {
          setView("dashboard");
        }
      } catch {
        clearToken();
      } finally {
        if (mounted) setBooting(false);
      }
    }
    restoreSession();
    return () => { mounted = false; };
  }, []);

  const handleAuthenticated = (session) => {
    saveToken(session.token);
    setUser(session.user);
    setView("dashboard");
  };

  const startDay = async (dayNumber) => {
    const { attempt: newAttempt } = await api("/api/attempts", { method: "POST", body: { dayNumber } });
    localStorage.setItem(ATTEMPT_KEY, String(newAttempt.id));
    const details = await api(`/api/attempts/${newAttempt.id}`);
    setAttempt(details);
    setView("exam");
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem(ATTEMPT_KEY);
    setUser(null);
    setAttempt(null);
    setReport(null);
    setView("login");
  };

  if (booting) return <main className="loading-screen"><div className="loader" /><span>Menyiapkan simulator OSCE...</span></main>;
  if (!user) return <LoginScreen onAuthenticated={handleAuthenticated} />;
  if (view === "dashboard") return <Dashboard user={user} onStartDay={startDay} onLogout={logout} />;
  if (view === "report" && report) return <ReportPage report={report} user={user} onLogout={logout} onHome={() => { localStorage.removeItem(ATTEMPT_KEY); setAttempt(null); setReport(null); setView("dashboard"); }} />;
  if (view === "exam" && attempt) return <ExamFlow attemptInfo={attempt} user={user} onLogout={logout} onCompleted={setReportAndView(setReport, setView)} />;
  return <Dashboard user={user} onStartDay={startDay} onLogout={logout} />;
}

function setReportAndView(setReport, setView) {
  return (nextReport) => { setReport(nextReport); setView("report"); };
}

function LoginScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [fields, setFields] = useState({ name: "", nimOrNip: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const isRegister = mode === "register";
      const result = await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        token: null,
        body: isRegister ? fields : { email: fields.email, password: fields.password },
      });
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <div className="brand-mark">TF</div>
        <div className="eyebrow light">SIMULATOR UJIAN FARMASI</div>
        <h1>Latihan OSCE dengan alur ujian yang nyata.</h1>
        <p>Masuk ke ruang simulasi, pilih hari ujian, dan jalani station sesuai waktu yang ditetapkan.</p>
        <div className="auth-meta"><span>10 station</span><i /> <span>3 fase waktu</span><i /> <span>3 hari ujian</span></div>
        <div className="auth-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card"><span>OSCE</span><b>Farmasi</b><small>UKMPPAI</small></div></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="eyebrow">PORTAL PESERTA</div>
          <h2>{mode === "login" ? "Selamat datang" : "Buat akun peserta"}</h2>
          <p className="muted">{mode === "login" ? "Masuk untuk melanjutkan latihan OSCE Anda." : "Daftar akun untuk mulai menggunakan simulator."}</p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && <>
              <label>Nama lengkap<input required value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} placeholder="Nama peserta" autoComplete="name" /></label>
              <label>NIM / NIP<input required value={fields.nimOrNip} onChange={(e) => setFields({ ...fields, nimOrNip: e.target.value })} placeholder="Nomor identitas" /></label>
            </>}
            <label>Email<input type="email" required value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} placeholder="nama@email.com" autoComplete="email" /></label>
            <label>Kata sandi<input type="password" required minLength={mode === "register" ? 8 : 1} value={fields.password} onChange={(e) => setFields({ ...fields, password: e.target.value })} placeholder={mode === "register" ? "Minimal 8 karakter" : "Masukkan kata sandi"} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
            {error && <div className="alert error" role="alert">{error}</div>}
            <button className="button primary full" disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk ke simulator" : "Daftar dan masuk"}<span>→</span></button>
          </form>
          <div className="auth-switch">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Daftar peserta" : "Masuk"}</button></div>
          <div className="secure-note"><span>◆</span> Sesi ujian Anda tersimpan secara aman</div>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ user, onStartDay, onLogout }) {
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [busyDay, setBusyDay] = useState(null);

  useEffect(() => {
    api("/api/exams/days").then(({ days: examDays }) => setDays(examDays)).catch((requestError) => setError(requestError.message));
  }, []);

  const begin = async (dayNumber) => {
    setBusyDay(dayNumber);
    setError("");
    try { await onStartDay(dayNumber); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusyDay(null); }
  };

  return (
    <div className="app-shell">
      <Header user={user} onLogout={onLogout} />
      <main className="dashboard-content">
        <div className="welcome-row"><div><div className="eyebrow">AREA PESERTA</div><h1>Selamat datang, {user.name.split(" ")[0]}</h1><p className="muted">Pilih paket hari untuk memulai simulasi OSCE.</p></div><div className="welcome-icon">✳</div></div>
        <section className="dashboard-banner"><div><span className="banner-kicker">SIMULASI OSCE UKMPPAI</span><h2>Siap menguji kompetensi Anda?</h2><p>Setiap station memiliki waktu 11 menit: membaca instruksi, mengerjakan, lalu berpindah.</p></div><div className="banner-stats"><div><b>10</b><span>station</span></div><div><b>3</b><span>fase waktu</span></div><div><b>6</b><span>kompetensi</span></div></div></section>
        <div className="section-heading"><div><h2>Pilih hari ujian</h2><p className="muted">Paket latihan tersedia berdasarkan soal yang sudah disiapkan.</p></div><span className="section-note">DAY 1 — DAY 3</span></div>
        {error && <div className="alert error">{error}</div>}
        <div className="day-grid">
          {days.map((day) => <DayCard key={day.dayNumber} day={day} busy={busyDay === day.dayNumber} onStart={() => begin(day.dayNumber)} />)}
          {days.length === 0 && !error && <div className="empty-card">Memuat paket ujian...</div>}
        </div>
        <div className="dashboard-footnote"><span className="info-dot">i</span><span>Station 5 adalah ruang istirahat. Setiap paket hari berisi 9 station soal dan 1 station istirahat.</span></div>
      </main>
    </div>
  );
}

function DayCard({ day, busy, onStart }) {
  const accent = ["blue", "green", "violet"][day.dayNumber - 1] || "blue";
  return (
    <article className={`day-card ${accent} ${!day.isReady ? "unavailable" : ""}`}>
      <div className="day-card-top"><div className="day-icon">{String(day.dayNumber).padStart(2, "0")}</div><span className={`status-pill ${day.isReady ? "ready" : "pending"}`}><i />{day.isReady ? "Siap dimainkan" : "Belum lengkap"}</span></div>
      <div className="day-label">PAKET UJIAN</div><h3>Day {day.dayNumber}</h3><p>{day.dayNumber === 1 ? "Fondasi pelayanan dan mutu sediaan." : day.dayNumber === 2 ? "Praktik klinis, produksi, dan distribusi." : "Integrasi kompetensi dan evaluasi kasus."}</p>
      <div className="day-card-meta"><span>◷ &nbsp;{day.stationLengthMinutes} menit / station</span><span>▦ &nbsp;{day.stationCount}/{day.expectedStations} station tersedia</span></div>
      {!day.isReady && <div className="missing-note">{day.missingStations.map((station) => `Soal Station ${station} menunggu dosen`).join(" · ")}</div>}
      <button className={`button ${day.isReady ? "primary" : "disabled"} full`} disabled={!day.isReady || busy} onClick={onStart}>{busy ? "Menyiapkan..." : day.isReady ? "Mulai Day " + day.dayNumber : "Belum dapat dimulai"}<span>→</span></button>
    </article>
  );
}

function ExamFlow({ attemptInfo, user, onLogout, onCompleted }) {
  const [attempt, setAttempt] = useState(attemptInfo.attempt);
  const [stations, setStations] = useState(attemptInfo.stations || []);
  const [bundle, setBundle] = useState(null);
  const [answer, setAnswer] = useState("");
  const [saveState, setSaveState] = useState("");
  const [loadError, setLoadError] = useState("");
  const previousStation = useRef(attemptInfo.attempt.currentStation);

  const loadBundle = useCallback(async (stationNumber) => {
    setLoadError("");
    try {
      const data = await api(`/api/attempts/${attemptInfo.attempt.id}/station/${stationNumber}/bundle`);
      setBundle(data);
      setAnswer(data.savedAnswers?.answerText || "");
      sendStationToGodot(data);
    } catch (error) { setLoadError(error.message); }
  }, [attemptInfo.attempt.id]);

  useEffect(() => {
    loadBundle(attempt.currentStation);
    const socket = io(API_BASE, { auth: { token: getToken() } });
    socket.on("connect", () => socket.emit("attempt:join", { attemptId: attemptInfo.attempt.id }));
    socket.on("timer:update", (state) => {
      setAttempt(state);
      if (state.currentStation !== previousStation.current && !state.finishedAt) {
        previousStation.current = state.currentStation;
        loadBundle(state.currentStation);
        api(`/api/attempts/${attemptInfo.attempt.id}`).then((data) => setStations(data.stations)).catch(() => {});
      }
    });
    socket.on("timer:finished", async () => {
      try {
        const finalReport = await api(`/api/attempts/${attemptInfo.attempt.id}/report`);
        onCompleted(finalReport);
      } catch (error) { setLoadError(error.message); }
    });
    socket.on("attempt:error", ({ error }) => setLoadError(error));
    return () => socket.disconnect();
  }, [attemptInfo.attempt.id, loadBundle, onCompleted]);

  useEffect(() => {
    if (!bundle?.submissionId) return;
    registerGodotListener(async (eventCode, payload) => {
      try {
        await api(`/api/submissions/${bundle.submissionId}/events`, { method: "POST", body: { eventCode, payload } });
      } catch (error) { setLoadError(error.message); }
    });
  }, [bundle?.submissionId]);

  const saveAnswer = async () => {
    setSaveState("saving");
    try {
      await api(`/api/attempts/${attemptInfo.attempt.id}/stations/${attempt.currentStation}/answers`, { method: "PUT", body: { answerText: answer } });
      setSaveState("saved");
      window.setTimeout(() => setSaveState(""), 2200);
    } catch (error) { setSaveState(error.message); }
  };

  const isWork = attempt.currentPhase === "WORK";
  const phaseLabel = { READ: "Baca instruksi", WORK: "Waktu mengerjakan", MOVE: "Pindah station", FINISHED: "Selesai" }[attempt.currentPhase] || "Menyiapkan";
  const station = stations.find((item) => item.stationNumber === attempt.currentStation);

  return (
    <div className="exam-shell">
      <header className="exam-topbar"><div className="exam-brand"><span className="mini-brand">TF</span><div><b>OSCE Simulator</b><small>Day {attempt.dayNumber} · Sesi latihan</small></div></div><div className="exam-top-right"><span className="live-pill"><i /> SESI BERJALAN</span><button className="user-chip" onClick={onLogout}><span className="avatar-small">{user.name.charAt(0)}</span>{user.name}<span className="chevron">⌄</span></button></div></header>
      <main className="exam-layout">
        <aside className="station-rail"><div className="rail-heading"><div><span className="eyebrow">RUTE UJIAN</span><h3>Station</h3></div><span className="rail-count">{attempt.currentStation}<small>/10</small></span></div><div className="station-list">{stations.map((item) => <div key={item.stationNumber} className={`station-nav ${item.stationNumber === attempt.currentStation ? "active" : ""} ${item.stationNumber < attempt.currentStation ? "complete" : ""}`}><span className="station-index">{item.isRestStation ? "☕" : item.stationNumber < attempt.currentStation ? "✓" : String(item.stationNumber).padStart(2, "0")}</span><span className="station-nav-text"><b>{item.isRestStation ? "Istirahat" : `Station ${item.stationNumber}`}</b><small>{item.title}</small></span>{item.stationNumber === attempt.currentStation && <span className="current-dot" />}</div>)}</div><div className="rail-help"><span>✦</span><div><b>Fokus pada proses</b><p>Kerjakan sesuai instruksi dan catat langkah penting Anda.</p></div></div></aside>
        <section className="station-main">
          <div className="station-toolbar"><div><div className="eyebrow">DAY {attempt.dayNumber} <span>/</span> {bundle?.template?.code || station?.templateCode || "STATION"}</div><h1>{bundle?.isRestStation ? "Waktu istirahat" : station?.title || `Station ${attempt.currentStation}`}</h1></div><div className={`phase-clock ${attempt.currentPhase?.toLowerCase() || "read"}`}><span className="clock-icon">◷</span><div><small>{phaseLabel.toUpperCase()}</small><b>{formatTime(attempt.remainingSec)}</b></div></div></div>
          <div className="phase-track"><div className={`phase-step ${["READ", "WORK", "MOVE", "FINISHED"].includes(attempt.currentPhase) ? "done" : ""} ${attempt.currentPhase === "READ" ? "now" : ""}`}><i>1</i><span>Baca instruksi</span><small>1 menit</small></div><div className={`phase-line ${["WORK", "MOVE", "FINISHED"].includes(attempt.currentPhase) ? "filled" : ""}`} /><div className={`phase-step ${["WORK", "MOVE", "FINISHED"].includes(attempt.currentPhase) ? "done" : ""} ${attempt.currentPhase === "WORK" ? "now" : ""}`}><i>2</i><span>Mengerjakan</span><small>9 menit</small></div><div className={`phase-line ${["MOVE", "FINISHED"].includes(attempt.currentPhase) ? "filled" : ""}`} /><div className={`phase-step ${["MOVE", "FINISHED"].includes(attempt.currentPhase) ? "done" : ""} ${attempt.currentPhase === "MOVE" ? "now" : ""}`}><i>3</i><span>Pindah</span><small>1 menit</small></div></div>
          {loadError && <div className="alert error">{loadError}</div>}
          {bundle && <div className={`instruction-card ${bundle.isRestStation ? "rest" : ""}`}><div className="instruction-label"><span>▤</span>{bundle.isRestStation ? "RUANG ISTIRAHAT" : "INSTRUKSI DI DEPAN PINTU"}<span className="template-chip">{bundle.template.code}</span></div><p>{bundle.doorInstruction}</p>{bundle.hasMicrophone && <span className="mic-available">◉ Dialog pasien tersedia</span>}</div>}
          {bundle?.items?.length > 0 && <section className="materials-card"><div className="card-title-row"><div><span className="eyebrow">OBJEK STATION</span><h3>Informasi yang tersedia</h3></div><span className="object-count">{bundle.items.length} item</span></div><div className="item-list">{bundle.items.map((item, index) => <div className="item-row" key={`${item.slotId}-${index}`}><span className="item-symbol">{item.model3dKey?.includes("tablet") ? "▧" : "◈"}</span><span className="item-name"><b>{item.name}</b><small>{item.slotId} · {item.drugClass?.replaceAll("_", " ")}</small></span><span className={`condition ${item.condition?.toLowerCase()}`}>{conditionLabel(item.condition)}</span></div>)}</div></section>}
          {!bundle?.isRestStation && bundle && <section className="answer-card"><div className="card-title-row"><div><span className="eyebrow">LEMBAR KERJA</span><h3>Catatan dan jawaban Anda</h3></div><span className="draft-label">Draft jawaban</span></div><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!isWork} placeholder={isWork ? "Tuliskan hasil penggalian data, analisis, keputusan, atau edukasi yang Anda lakukan..." : "Lembar kerja dapat diisi saat fase mengerjakan."} /><div className="answer-actions"><span className="muted small">{isWork ? "Simpan jawaban sebelum waktu station berakhir." : "Jawaban terkunci di luar fase mengerjakan."}</span><button className="button primary" onClick={saveAnswer} disabled={!isWork || saveState === "saving"}>{saveState === "saving" ? "Menyimpan..." : saveState === "saved" ? "Tersimpan ✓" : "Simpan jawaban"}</button></div>{saveState && saveState !== "saving" && saveState !== "saved" && <div className="inline-error">{saveState}</div>}</section>}
          {bundle?.isRestStation && <div className="rest-message"><span>☕</span><div><b>Tarik napas sejenak</b><p>Station berikutnya akan terbuka otomatis saat fase pindah selesai.</p></div></div>}
          <div className="exam-bottom-note"><span>◉</span> Waktu dan perpindahan station dikelola oleh server.</div>
        </section>
      </main>
    </div>
  );
}

function ReportPage({ report, user, onLogout, onHome }) {
  return <div className="app-shell"><Header user={user} onLogout={onLogout} /><main className="report-content"><div className="report-hero"><div className="report-check">✓</div><div className="eyebrow">DAY {report.dayNumber} SELESAI</div><h1>Simulasi Anda selesai.</h1><p className="muted">Terima kasih telah menyelesaikan seluruh station.</p><div className="report-stats"><div><b>{report.stations.filter((item) => item.completed).length}<small>/10</small></b><span>station selesai</span></div><div><b>{Math.round(report.totalScore)}</b><span>skor tercatat</span></div><div><b>{report.earnedXp}</b><span>XP diperoleh</span></div></div></div><section className="report-table"><div className="card-title-row"><div><span className="eyebrow">RINGKASAN</span><h2>Perjalanan station</h2></div></div>{report.stations.map((station) => <div className="report-row" key={station.stationNumber}><span className="report-num">{String(station.stationNumber).padStart(2, "0")}</span><div><b>{station.title}</b><small>{station.templateCode}</small></div><span className={`report-status ${station.completed ? "complete" : "pending"}`}>{station.completed ? "Selesai" : "Belum dinilai"}</span><b className="report-score">{station.score}</b></div>)}</section><button className="button primary report-home" onClick={onHome}>Kembali ke dashboard <span>→</span></button></main></div>;
}

function Header({ user, onLogout }) {
  return <header className="site-header"><div className="site-brand"><span className="mini-brand">TF</span><div><b>TemanFarmasi</b><small>OSCE Simulator</small></div></div><div className="header-right"><span className="header-context">UKMPPAI · SIMULATOR</span><button className="user-chip" onClick={onLogout}><span className="avatar-small">{user.name.charAt(0)}</span><span>{user.name}</span><span className="chevron">⌄</span></button></div></header>;
}

function formatTime(value = 0) { const total = Math.max(0, Number(value) || 0); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function conditionLabel(value) { return ({ GOOD: "Baik", DAMAGED: "Rusak", LEAKING: "Bocor", EXPIRED: "Kedaluwarsa", BROKEN_SEAL: "Segel rusak", PRECIPITATE: "Endapan" })[value] || value || "Baik"; }
