const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "osce_dev_secret_key_change_in_prod";

// In-memory store sementara (struktur identik dengan model User di schema.prisma milik Gilang)
const users = [
  {
    id: 1,
    nimOrNip: "20261041001",
    name: "Azzahra (Mahasiswa Demo)",
    email: "mahasiswa@osce.ac.id",
    passwordHash: bcrypt.hashSync("123456", 8),
    role: "STUDENT",
    avatarId: "apoteker_wanita",
    totalXp: 120,
    level: 2,
    badges: ["FIRST_LOGIN"],
  },
  {
    id: 2,
    nimOrNip: "DSN-001",
    name: "apt. Dosen Pembimbing",
    email: "dosen@osce.ac.id",
    passwordHash: bcrypt.hashSync("123456", 8),
    role: "LECTURER",
    avatarId: "penguji_default",
    totalXp: 0,
    level: 1,
    badges: [],
  },
];

function sanitizeUser(u) {
  return {
    id: u.id,
    nimOrNip: u.nimOrNip,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarId: u.avatarId,
    totalXp: u.totalXp,
    level: u.level,
    badges: u.badges,
  };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Token login diperlukan." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find((u) => u.id === decoded.id);
    if (!user) return res.status(401).json({ error: "User tidak ditemukan." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa." });
  }
}

router.post("/register", (req, res) => {
  const { nimOrNip, name, email, password, role = "STUDENT" } = req.body;
  if (!nimOrNip || !name || !email || !password) {
    return res.status(400).json({ error: "Semua kolom (NIM/NIP, nama, email, password) wajib diisi." });
  }
  if (users.some((u) => u.email === email || u.nimOrNip === nimOrNip)) {
    return res.status(409).json({ error: "Email atau NIM/NIP sudah terdaftar." });
  }
  const newUser = {
    id: users.length + 1,
    nimOrNip,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 8),
    role: role === "LECTURER" ? "LECTURER" : "STUDENT",
    avatarId: "apoteker_default",
    totalXp: 0,
    level: 1,
    badges: ["FIRST_LOGIN"],
  };
  users.push(newUser);
  const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: "12h" });
  res.status(201).json({ token, user: sanitizeUser(newUser) });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email || u.nimOrNip === email);
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Email/NIM atau password salah." });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, user: sanitizeUser(user) });
});

router.get("/me", authMiddleware, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

module.exports = { authRouter: router, authMiddleware, users, sanitizeUser };
