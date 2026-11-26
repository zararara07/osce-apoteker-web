import React, { useState } from "react";
import { apiRequest } from "../api";

export default function LoginPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    nimOrNip: "",
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form;
      const data = await apiRequest(endpoint, { method: "POST", body: payload });
      onAuthSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email) => {
    setMode("login");
    setForm((prev) => ({ ...prev, email, password: "123456" }));
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ marginBottom: 16 }}>
          <span className="pill pill-blue">UKMPPAI OSCE 3D Simulator</span>
          <h2 style={{ margin: "8px 0 4px", color: "#0f172a" }}>
            {mode === "login" ? "Masuk ke Simulator OSCE" : "Daftar Akun Baru"}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            10 Station Interaktif (Day 1–3) • Gamifikasi &amp; Mikrofon NPC
          </p>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label className="label">NIM / NIP</label>
              <input
                className="input"
                value={form.nimOrNip}
                onChange={(e) => setForm({ ...form, nimOrNip: e.target.value })}
                placeholder="Contoh: 20261041099"
                required
              />
              <label className="label">Nama Lengkap</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama Mahasiswa / Dosen"
                required
              />
              <label className="label">Peran</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="STUDENT">Mahasiswa Apoteker</option>
                <option value="LECTURER">Dosen / Penguji</option>
              </select>
            </>
          )}

          <label className="label">Email atau NIM</label>
          <input
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="mahasiswa@osce.ac.id"
            required
          />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••"
            required
          />

          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar & Masuk"}
          </button>
        </form>

        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ flex: 1, fontSize: 12 }}
            onClick={() => fillDemo("mahasiswa@osce.ac.id")}
          >
            Isi Demo Mahasiswa
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ flex: 1, fontSize: 12 }}
            onClick={() => fillDemo("dosen@osce.ac.id")}
          >
            Isi Demo Dosen
          </button>
        </div>

        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
          {mode === "login" ? (
            <>
              Belum punya akun?{" "}
              <a href="#reg" onClick={(e) => { e.preventDefault(); setMode("register"); }}>
                Daftar di sini
              </a>
            </>
          ) : (
            <>
              Sudah punya akun?{" "}
              <a href="#log" onClick={(e) => { e.preventDefault(); setMode("login"); }}>
                Login
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
