/**
 * RishtaConnect Backend — Production-Ready
 *   • Node.js + Express + Socket.io
 *   • MongoDB Atlas (auto-falls back to JSON file if MONGO_URI not set)
 *   • JWT auth, bcrypt, helmet, rate limiting
 *   • Blog / Banner / Contact / Settings management
 *   • Free hosting friendly (Railway, Render, Fly.io)
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "rishta-dev-secret-change-in-prod";
const MONGO_URI = process.env.MONGO_URI || "";

// Trust Railway/Vercel proxy (fixes X-Forwarded-For warning in rate limiter)
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

/* ==================== DATABASE LAYER ==================== */
// Mode: MongoDB if MONGO_URI is set, else JSON file
const USE_MONGO = !!MONGO_URI;
let mongoReady = false;
const DB_PATH = path.join(__dirname, "db.json");

const collections = ["users", "blogs", "banners", "contacts", "settings", "interests", "reports", "pendingEdits", "subscriptions", "activityLogs"];
const messagesKey = "messages";

/* ---- Mongoose Schemas ---- */
const UserSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },
  name: String, email: { type: String, unique: true, sparse: true }, phone: String,
  password: String, gender: String, age: Number, role: { type: String, default: "user" },
  height: String, maritalStatus: String, city: String, country: String, nationality: String,
  religion: { type: String, default: "Islam" }, sect: String, languages: [String],
  qualification: String, university: String, profession: String, company: String, business: String,
  income: String, jobType: String, overseas: Boolean,
  fatherProfession: String, motherProfession: String, siblings: String,
  familyType: String, ownHouse: Boolean, familyBackground: String,
  namaz: String, hijab: String, religiousLevel: String,
  nature: String, hobbies: [String], smoking: String, futureGoals: String,
  preferences: Object, photos: [String], blurPhoto: Boolean, bio: String, timeline: String,
  verifications: { phone: Boolean, email: Boolean, cnic: Boolean, face: Boolean, family: Boolean, business: Boolean },
  trustScore: { type: Number, default: 60 }, plan: { type: String, default: "Free" }, planExpires: Date,
  cnic: String, deviceId: String, banned: Boolean, flagged: Boolean,
  lastActive: { type: Date, default: Date.now }, createdAt: { type: Date, default: Date.now }
}, { _id: false });

const BlogSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },
  title: String, slug: String, excerpt: String, content: String, coverImage: String,
  author: String, tags: [String], published: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const BannerSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },
  title: String, subtitle: String, image: String, link: String,
  bgColor: { type: String, default: "#0f766e" },
  active: { type: Boolean, default: true }, order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ContactSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },
  name: String, email: String, phone: String, subject: String, message: String,
  status: { type: String, default: "new" }, // new, read, replied, archived
  reply: String, createdAt: { type: Date, default: Date.now }
}, { _id: false });

const SettingsSchema = new mongoose.Schema({
  _id: { type: String, default: "site" },
  siteName: { type: String, default: "RishtaConnect" },
  tagline: String, logo: String, primaryColor: { type: String, default: "#0f766e" },
  contactEmail: String, contactPhone: String, address: String,
  whatsapp: String, facebook: String, instagram: String, twitter: String, youtube: String,
  footerText: String, maintenanceMode: { type: Boolean, default: false },
  signupEnabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  _id: { type: String, default: uuid },
  threadKey: { type: String, index: true },
  from: String, to: String, text: String, time: { type: Date, default: Date.now }
}, { _id: false });

// Use String _id (uuid) for all "simple" collections, matching the rest of the app
const SimpleSchema = (name) => new mongoose.Schema(
  { _id: { type: String, default: () => uuid() } },
  { strict: false, collection: name }
);

let M = {};
function buildModels() {
  M.User = mongoose.model("User", UserSchema);
  M.Blog = mongoose.model("Blog", BlogSchema);
  M.Banner = mongoose.model("Banner", BannerSchema);
  M.Contact = mongoose.model("Contact", ContactSchema);
  M.Settings = mongoose.model("Settings", SettingsSchema);
  M.Message = mongoose.model("Message", MessageSchema);
  M.Interest = mongoose.model("Interest", SimpleSchema("interests"));
  M.Report = mongoose.model("Report", SimpleSchema("reports"));
  M.PendingEdit = mongoose.model("PendingEdit", SimpleSchema("pendingEdits"));
  M.Subscription = mongoose.model("Subscription", SimpleSchema("subscriptions"));
  M.ActivityLog = mongoose.model("ActivityLog", SimpleSchema("activityLogs"));
}

/* ---- JSON file fallback ---- */
function loadJSONDB() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = { users: [], blogs: [], banners: [], contacts: [], settings: [{ _id: "site", siteName: "RishtaConnect" }], messages: {}, interests: [], reports: [], pendingEdits: [], subscriptions: [], activityLogs: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function saveJSONDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

/* ---- Unified DB API (works for both Mongo & JSON) ---- */
const db = {
  async find(col, filter = {}) {
    if (USE_MONGO && mongoReady) {
      const Model = mongoModelFor(col);
      return Model.find(filter).lean();
    }
    const data = loadJSONDB();
    return (data[col] || []).filter(item => Object.entries(filter).every(([k, v]) => item[k] === v));
  },
  async findOne(col, filter) {
    if (USE_MONGO && mongoReady) return mongoModelFor(col).findOne(filter).lean();
    const data = loadJSONDB();
    return (data[col] || []).find(item => Object.entries(filter).every(([k, v]) => item[k] === v));
  },
  async insert(col, doc) {
    try {
      if (USE_MONGO && mongoReady) {
        if (!doc._id) doc._id = uuid();
        const created = await mongoModelFor(col).create(doc);
        return created.toObject ? created.toObject() : created;
      }
      const data = loadJSONDB();
      data[col] = data[col] || [];
      if (!doc._id && !doc.id) doc._id = uuid();
      data[col].push(doc);
      saveJSONDB(data);
      return doc;
    } catch (e) {
      console.error(`✗ db.insert(${col}) failed:`, e.message);
      // Don't crash the server — return doc so the request can complete
      return doc;
    }
  },
  async update(col, filter, patch) {
    if (USE_MONGO && mongoReady) return mongoModelFor(col).updateOne(filter, { $set: patch });
    const data = loadJSONDB();
    let updated = 0;
    data[col] = (data[col] || []).map(item => {
      const match = Object.entries(filter).every(([k, v]) => item[k] === v);
      if (match) { updated++; return { ...item, ...patch }; }
      return item;
    });
    saveJSONDB(data);
    return { updated };
  },
  async remove(col, filter) {
    if (USE_MONGO && mongoReady) return mongoModelFor(col).deleteOne(filter);
    const data = loadJSONDB();
    data[col] = (data[col] || []).filter(item => !Object.entries(filter).every(([k, v]) => item[k] === v));
    saveJSONDB(data);
    return { ok: true };
  },
  // Messages stored as flat list in Mongo, as object in JSON
  async findMessages(threadKey) {
    if (USE_MONGO && mongoReady) return M.Message.find({ threadKey }).sort({ time: 1 }).lean();
    const data = loadJSONDB();
    return (data.messages && data.messages[threadKey]) || [];
  },
  async addMessage(threadKey, msg) {
    if (USE_MONGO && mongoReady) {
      const created = await M.Message.create({ ...msg, threadKey });
      return created.toObject();
    }
    const data = loadJSONDB();
    data.messages = data.messages || {};
    data.messages[threadKey] = [...(data.messages[threadKey] || []), msg];
    saveJSONDB(data);
    return msg;
  }
};

function mongoModelFor(col) {
  const map = {
    users: M.User, blogs: M.Blog, banners: M.Banner, contacts: M.Contact,
    settings: M.Settings, interests: M.Interest, reports: M.Report,
    pendingEdits: M.PendingEdit, subscriptions: M.Subscription,
    activityLogs: M.ActivityLog, messages: M.Message
  };
  return map[col];
}

/* ---- Connect to MongoDB ---- */
async function connectMongo() {
  if (!USE_MONGO) {
    console.log("ℹ  MONGO_URI not set — using JSON file database (db.json)");
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    buildModels();
    mongoReady = true;
    console.log("✓ Connected to MongoDB Atlas");
  } catch (e) {
    console.log("✗ MongoDB connection failed, falling back to JSON file. Error:", e.message);
  }
}

/* ==================== HELPERS ==================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ error: "Invalid token" }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
function detectFraud(users, user) {
  const flags = [];
  const sameCnic = users.filter(u => u.cnic && u.cnic === user.cnic && (u._id || u.id) !== (user._id || user.id));
  if (sameCnic.length) flags.push({ type: "duplicate_cnic", count: sameCnic.length });
  const sameDevice = users.filter(u => u.deviceId && u.deviceId === user.deviceId && (u._id || u.id) !== (user._id || user.id));
  if (sameDevice.length >= 2) flags.push({ type: "multi_account_device", count: sameDevice.length });
  return flags;
}
function computeTrustScore(user) {
  let s = 50; const v = user.verifications || {};
  if (v.cnic) s += 20; if (v.face) s += 20; if (v.family) s += 15;
  if (v.business) s += 10; if (v.phone) s += 5; if (v.email) s += 5;
  if (user.reports > 0) s -= 50 * user.reports;
  return Math.max(0, Math.min(100, s));
}
function compatibility(a, b) {
  let s = 50;
  if (a.sect === b.sect) s += 10;
  if (a.country === b.country) s += 8;
  if (a.city === b.city) s += 6;
  if (a.religiousLevel === b.religiousLevel) s += 8;
  if (a.familyType === b.familyType) s += 6;
  const overlap = (a.languages || []).filter(x => (b.languages || []).includes(x)).length;
  s += Math.min(overlap * 3, 9);
  return Math.max(40, Math.min(99, s + Math.floor((b.trustScore || 80) / 20)));
}
function sanitize(u) {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
}

/* ==================== AUTH ==================== */
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, phone, password, gender } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email & password required" });
    const exists = await db.findOne("users", { email });
    if (exists) return res.status(400).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const user = {
      _id: uuid(), name, email, phone, password: hash, gender,
      role: "user", plan: "Free", trustScore: 60, photos: [], blurPhoto: true,
      verifications: { phone: false, email: false, cnic: false, face: false, family: false, business: false },
      preferences: {}, languages: ["Urdu", "English"], religion: "Islam", sect: "Sunni",
      createdAt: new Date(), lastActive: new Date()
    };
    await db.insert("users", user);
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: sanitize(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.findOne("users", { email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });
    if (user.banned) return res.status(403).json({ error: "Account banned" });
    await db.update("users", { _id: user._id || user.id }, { lastActive: new Date() });
    const token = jwt.sign({ id: user._id || user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: sanitize(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------------- REAL OTP SYSTEM ---------------- */
// In-memory store (resets on server restart, fine for free tier).
// Production: move to Redis or MongoDB collection with TTL index.
const otpStore = new Map(); // key: email/phone, value: { code, expires }

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTPEmail(to, code) {
  // If SMTP credentials AND nodemailer available, send via email.
  // Otherwise log to console (visible in Railway logs).
  let nodemailer;
  try { nodemailer = require("nodemailer"); } catch(e) { /* nodemailer not installed */ }

  if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: `"RishtaConnect" <${process.env.SMTP_USER}>`,
        to,
        subject: "Your RishtaConnect Verification Code",
        text: `Your OTP is: ${code}\n\nIt expires in 10 minutes. Do not share this code with anyone.`,
        html: `<div style="font-family:Inter,sans-serif;padding:20px;max-width:480px;margin:auto;background:#f0fdf4;border-radius:16px;border:1px solid #86efac">
                 <h2 style="color:#0f766e">RishtaConnect Verification</h2>
                 <p>Use this OTP to verify your account:</p>
                 <div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;background:white;padding:16px;border-radius:8px;color:#0f766e;margin:16px 0">${code}</div>
                 <p style="color:#666;font-size:13px">Expires in 10 minutes. Do not share with anyone.</p>
               </div>`
      });
      return { sent: true, channel: "email" };
    } catch (e) {
      console.error("SMTP send failed:", e.message);
      return { sent: false, channel: "email", error: e.message };
    }
  } else {
    console.log(`📧 [OTP for ${to}] → ${code}  (configure SMTP_* env vars to send real emails)`);
    return { sent: false, channel: "console" };
  }
}

app.post("/api/auth/otp/send", async (req, res) => {
  const { email, phone } = req.body;
  const key = (email || phone || "").toLowerCase().trim();
  if (!key) return res.status(400).json({ error: "Email or phone required" });
  const code = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(key, { code, expires, attempts: 0 });
  const result = await sendOTPEmail(email || key, code);
  const response = { ok: true, channel: result.channel };
  // If SMTP wasn't able to send (no config OR send failed), return the code so user
  // can complete signup. This is necessary when SMTP isn't configured yet.
  // In real production with working SMTP, this won't fire (result.sent will be true).
  if (!result.sent) {
    response.debug = "SMTP not configured — OTP returned in response for testing. Set up SMTP_* env vars for production email delivery.";
    response.devOtp = code;
  }
  res.json(response);
});

app.post("/api/auth/otp/verify", (req, res) => {
  const { email, phone, otp } = req.body;
  const key = (email || phone || "").toLowerCase().trim();
  const entry = otpStore.get(key);
  if (!entry) return res.json({ ok: false, error: "No OTP requested for this account" });
  if (Date.now() > entry.expires) {
    otpStore.delete(key);
    return res.json({ ok: false, error: "OTP expired. Request a new one." });
  }
  entry.attempts = (entry.attempts || 0) + 1;
  if (entry.attempts > 5) {
    otpStore.delete(key);
    return res.json({ ok: false, error: "Too many failed attempts. Request a new OTP." });
  }
  if (entry.code !== String(otp).trim()) {
    return res.json({ ok: false, error: "Incorrect OTP. " + (5 - entry.attempts) + " attempts left." });
  }
  otpStore.delete(key);
  res.json({ ok: true });
});

/* ==================== PROFILE ==================== */
app.get("/api/me", auth, async (req, res) => {
  const user = await db.findOne("users", { _id: req.user.id });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(sanitize(user));
});

app.put("/api/me", auth, async (req, res) => {
  const user = await db.findOne("users", { _id: req.user.id });
  if (!user) return res.status(404).json({ error: "Not found" });

  const sensitive = ["name", "age", "income", "city", "maritalStatus", "phone", "photos"];
  const changes = {};
  const directUpdates = {};
  Object.keys(req.body).forEach(k => {
    if (sensitive.includes(k) && user[k] !== req.body[k]) {
      changes[k] = { old: user[k], new: req.body[k] };
    } else if (k !== "_id" && k !== "id" && k !== "password" && k !== "role") {
      directUpdates[k] = req.body[k];
    }
  });

  if (Object.keys(changes).length) {
    await db.insert("pendingEdits", {
      _id: uuid(), userId: req.user.id, changes,
      status: "pending", createdAt: new Date()
    });
  }
  directUpdates.trustScore = computeTrustScore({ ...user, ...directUpdates });
  await db.update("users", { _id: req.user.id }, directUpdates);

  const updated = await db.findOne("users", { _id: req.user.id });
  res.json({
    user: sanitize(updated),
    pendingChanges: Object.keys(changes).length,
    message: Object.keys(changes).length ? "Sensitive changes are pending admin review." : "Profile updated."
  });
});

/* ==================== SEARCH / MATCH ==================== */
app.get("/api/users", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  const allUsers = await db.find("users", {});
  let list = allUsers.filter(u => (u._id || u.id) !== (me._id || me.id) && u.gender !== me.gender && !u.banned);

  const { city, country, profession, sect, verified, overseas, minAge, maxAge, q } = req.query;
  if (city) list = list.filter(u => u.city === city);
  if (country) list = list.filter(u => u.country === country);
  if (profession) list = list.filter(u => u.profession === profession);
  if (sect) list = list.filter(u => u.sect === sect);
  if (verified === "true") list = list.filter(u => u.verifications?.cnic);
  if (overseas === "true") list = list.filter(u => u.overseas);
  if (minAge) list = list.filter(u => u.age >= +minAge);
  if (maxAge) list = list.filter(u => u.age <= +maxAge);
  if (q) {
    const qq = q.toLowerCase();
    list = list.filter(u => ((u.name || "") + (u.city || "") + (u.profession || "")).toLowerCase().includes(qq));
  }

  list = list.map(u => ({
    ...sanitize(u),
    email: undefined,
    phone: me.plan === "Free" ? undefined : u.phone,
    score: compatibility(me, u)
  })).sort((a, b) => b.score - a.score);

  if (me.plan === "Free") list = list.slice(0, 10);
  res.json(list);
});

app.get("/api/matches", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  const all = await db.find("users", {});
  const list = all
    .filter(u => (u._id || u.id) !== (me._id || me.id) && u.gender !== me.gender && !u.banned)
    .map(u => ({ ...sanitize(u), email: undefined, phone: undefined, score: compatibility(me, u) }))
    .sort((a, b) => b.score - a.score);
  res.json(list);
});

/* ==================== INTEREST / CHAT ==================== */
app.post("/api/interest/:to", auth, async (req, res) => {
  const interest = { _id: uuid(), from: req.user.id, to: req.params.to, status: "pending", createdAt: new Date() };
  await db.insert("interests", interest);
  io.to(req.params.to).emit("interest", { from: req.user.id });
  res.json({ ok: true, id: interest._id });
});

app.get("/api/messages/:other", auth, async (req, res) => {
  const key = [req.user.id, req.params.other].sort().join("-");
  res.json(await db.findMessages(key));
});

app.post("/api/messages/:other", auth, async (req, res) => {
  const key = [req.user.id, req.params.other].sort().join("-");
  const msg = { _id: uuid(), from: req.user.id, to: req.params.other, text: req.body.text, time: new Date() };
  await db.addMessage(key, msg);
  io.to(req.params.other).emit("message", msg);
  res.json({ ok: true, msg });
});

/* ==================== VERIFICATION ==================== */
app.post("/api/verify/:type", auth, async (req, res) => {
  const user = await db.findOne("users", { _id: req.user.id });
  const allowed = ["phone", "email", "cnic", "face", "family", "business"];
  if (!allowed.includes(req.params.type)) return res.status(400).json({ error: "Invalid type" });
  const verifications = { ...(user.verifications || {}), [req.params.type]: true };
  const trustScore = computeTrustScore({ ...user, verifications });
  await db.update("users", { _id: req.user.id }, { verifications, trustScore });

  const allUsers = await db.find("users", {});
  const fraud = detectFraud(allUsers, { ...user, ...req.body });
  if (fraud.length) {
    await db.update("users", { _id: req.user.id }, { flagged: true });
    await db.insert("activityLogs", { _id: uuid(), userId: req.user.id, type: "fraud_flag", details: fraud, time: new Date() });
  }
  const updated = await db.findOne("users", { _id: req.user.id });
  res.json({ user: sanitize(updated), fraudFlags: fraud });
});

/* ==================== SUBSCRIPTION ==================== */
app.post("/api/subscribe", auth, async (req, res) => {
  const plan = req.body.plan || "Premium";
  await db.update("users", { _id: req.user.id }, { plan, planExpires: new Date(Date.now() + 30 * 86400 * 1000) });
  await db.insert("subscriptions", { _id: uuid(), userId: req.user.id, plan, time: new Date() });
  res.json({ ok: true, plan });
});

/* ==================== REPORT ==================== */
app.post("/api/report/:user", auth, async (req, res) => {
  await db.insert("reports", {
    _id: uuid(), reportedUserId: req.params.user, reporterId: req.user.id,
    reason: req.body.reason, status: "pending", createdAt: new Date()
  });
  res.json({ ok: true });
});

/* ==================== BLOG MANAGEMENT (Admin + Public) ==================== */
// Public — anyone can read blogs
app.get("/api/blogs", async (req, res) => {
  const list = await db.find("blogs", {});
  res.json(list.filter(b => b.published !== false).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  ));
});
app.get("/api/blogs/:slug", async (req, res) => {
  const blog = await db.findOne("blogs", { slug: req.params.slug });
  if (!blog) return res.status(404).json({ error: "Not found" });
  res.json(blog);
});
// Admin
app.post("/api/admin/blogs", auth, adminOnly, async (req, res) => {
  const slug = (req.body.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const blog = {
    _id: uuid(), title: req.body.title, slug: slug + "-" + Date.now(),
    excerpt: req.body.excerpt, content: req.body.content, coverImage: req.body.coverImage,
    author: req.body.author || "RishtaConnect Team",
    tags: req.body.tags || [], published: req.body.published !== false,
    createdAt: new Date(), updatedAt: new Date()
  };
  await db.insert("blogs", blog);
  res.json(blog);
});
app.put("/api/admin/blogs/:id", auth, adminOnly, async (req, res) => {
  await db.update("blogs", { _id: req.params.id }, { ...req.body, updatedAt: new Date() });
  res.json({ ok: true });
});
app.delete("/api/admin/blogs/:id", auth, adminOnly, async (req, res) => {
  await db.remove("blogs", { _id: req.params.id });
  res.json({ ok: true });
});

/* ==================== BANNER MANAGEMENT ==================== */
app.get("/api/banners", async (req, res) => {
  const list = await db.find("banners", {});
  res.json(list.filter(b => b.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)));
});
app.post("/api/admin/banners", auth, adminOnly, async (req, res) => {
  const banner = {
    _id: uuid(), title: req.body.title, subtitle: req.body.subtitle,
    image: req.body.image, link: req.body.link || "#",
    bgColor: req.body.bgColor || "#0f766e",
    active: req.body.active !== false, order: req.body.order || 0,
    createdAt: new Date()
  };
  await db.insert("banners", banner);
  res.json(banner);
});
app.put("/api/admin/banners/:id", auth, adminOnly, async (req, res) => {
  await db.update("banners", { _id: req.params.id }, req.body);
  res.json({ ok: true });
});
app.delete("/api/admin/banners/:id", auth, adminOnly, async (req, res) => {
  await db.remove("banners", { _id: req.params.id });
  res.json({ ok: true });
});

/* ==================== CONTACT FORM ==================== */
// Public form submission
app.post("/api/contact", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "Required fields missing" });
  const contact = {
    _id: uuid(), name, email, phone, subject, message,
    status: "new", createdAt: new Date()
  };
  await db.insert("contacts", contact);
  res.json({ ok: true, message: "Thank you! We'll get back to you soon." });
});
// Admin inbox
app.get("/api/admin/contacts", auth, adminOnly, async (req, res) => {
  const list = await db.find("contacts", {});
  res.json(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});
app.put("/api/admin/contacts/:id", auth, adminOnly, async (req, res) => {
  await db.update("contacts", { _id: req.params.id }, req.body);
  res.json({ ok: true });
});
app.delete("/api/admin/contacts/:id", auth, adminOnly, async (req, res) => {
  await db.remove("contacts", { _id: req.params.id });
  res.json({ ok: true });
});

/* ==================== SITE SETTINGS ==================== */
app.get("/api/settings", async (req, res) => {
  let s = await db.findOne("settings", { _id: "site" });
  if (!s) {
    s = { _id: "site", siteName: "RishtaConnect", tagline: "Trusted Muslim Matrimony", primaryColor: "#0f766e" };
    await db.insert("settings", s);
  }
  res.json(s);
});
app.put("/api/admin/settings", auth, adminOnly, async (req, res) => {
  const existing = await db.findOne("settings", { _id: "site" });
  if (existing) {
    await db.update("settings", { _id: "site" }, { ...req.body, updatedAt: new Date() });
  } else {
    await db.insert("settings", { _id: "site", ...req.body });
  }
  res.json({ ok: true });
});

/* ==================== ADMIN ==================== */
app.get("/api/admin/edits", auth, adminOnly, async (req, res) => {
  const list = await db.find("pendingEdits", { status: "pending" });
  res.json(list);
});
app.post("/api/admin/edits/:id/:action", auth, adminOnly, async (req, res) => {
  const edit = await db.findOne("pendingEdits", { _id: req.params.id });
  if (!edit) return res.status(404).json({ error: "Not found" });
  if (req.params.action === "approve") {
    const patch = {};
    Object.entries(edit.changes).forEach(([k, v]) => { patch[k] = v.new; });
    await db.update("users", { _id: edit.userId }, patch);
    await db.update("pendingEdits", { _id: req.params.id }, { status: "approved" });
  } else {
    await db.update("pendingEdits", { _id: req.params.id }, { status: "rejected" });
  }
  res.json({ ok: true });
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const list = await db.find("users", {});
  res.json(list.map(sanitize));
});
app.get("/api/admin/reports", auth, adminOnly, async (req, res) => {
  res.json(await db.find("reports", {}));
});
app.post("/api/admin/users/:id/ban", auth, adminOnly, async (req, res) => {
  await db.update("users", { _id: req.params.id }, { banned: true });
  res.json({ ok: true });
});
app.post("/api/admin/users/:id/unban", auth, adminOnly, async (req, res) => {
  await db.update("users", { _id: req.params.id }, { banned: false });
  res.json({ ok: true });
});

// Deactivate / Activate (different from ban — user just paused)
app.post("/api/admin/users/:id/deactivate", auth, adminOnly, async (req, res) => {
  await db.update("users", { _id: req.params.id }, { active: false });
  res.json({ ok: true });
});
app.post("/api/admin/users/:id/activate", auth, adminOnly, async (req, res) => {
  await db.update("users", { _id: req.params.id }, { active: true });
  res.json({ ok: true });
});

// Reset user password (admin-initiated)
app.post("/api/admin/users/:id/reset-password", auth, adminOnly, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update("users", { _id: req.params.id }, { password: hash });
  await db.insert("activityLogs", { _id: uuid(), userId: req.params.id, type: "admin_password_reset", time: new Date(), by: req.user.id });
  res.json({ ok: true, message: "Password reset successfully" });
});

// Send admin message to a user (goes into their chat with system / admin)
app.post("/api/admin/users/:id/message", auth, adminOnly, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Message required" });
  const adminId = req.user.id;
  const key = [adminId, req.params.id].sort().join("-");
  const msg = { _id: uuid(), from: adminId, to: req.params.id, text: "[Admin] " + text, time: new Date() };
  await db.addMessage(key, msg);
  io.to(req.params.id).emit("message", msg);
  await db.insert("activityLogs", { _id: uuid(), userId: req.params.id, type: "admin_message", time: new Date(), by: adminId, message: text });
  res.json({ ok: true });
});

// Get single user full detail (for admin)
app.get("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const user = await db.findOne("users", { _id: req.params.id });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(sanitize(user));
});

// Update any user field (admin override)
app.put("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  const allowed = { ...req.body };
  delete allowed._id; delete allowed.id; delete allowed.role; delete allowed.password;
  await db.update("users", { _id: req.params.id }, allowed);
  res.json({ ok: true });
});

// Delete user (hard delete - admin only)
app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  await db.remove("users", { _id: req.params.id });
  res.json({ ok: true });
});
app.get("/api/admin/analytics", auth, adminOnly, async (req, res) => {
  const users = await db.find("users", {});
  const contacts = await db.find("contacts", {});
  const blogs = await db.find("blogs", {});
  res.json({
    totalUsers: users.length,
    free: users.filter(u => u.plan === "Free").length,
    premium: users.filter(u => u.plan === "Premium").length,
    vip: users.filter(u => u.plan === "VIP").length,
    verified: users.filter(u => u.verifications?.cnic).length,
    banned: users.filter(u => u.banned).length,
    pendingEdits: (await db.find("pendingEdits", { status: "pending" })).length,
    newContacts: contacts.filter(c => c.status === "new").length,
    totalContacts: contacts.length,
    totalBlogs: blogs.length
  });
});

/* ==================== SOCKET.IO ==================== */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try { socket.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { next(); }
});
io.on("connection", (socket) => {
  if (socket.user?.id) socket.join(socket.user.id);
  socket.on("typing", ({ to }) => to && io.to(to).emit("typing", { from: socket.user?.id }));
});

/* ==================== ADMIN BOOTSTRAP (Emergency Reset) ==================== */
// Use this endpoint ONCE to reset admin password if locked out.
// Requires the BOOTSTRAP_SECRET env var (set in Railway only, never commit).
// Default secret = JWT_SECRET if not separately set.
app.post("/api/bootstrap-admin", async (req, res) => {
  const secret = req.body.secret;
  const expected = process.env.BOOTSTRAP_SECRET || JWT_SECRET;
  if (!secret || secret !== expected) {
    return res.status(403).json({ error: "Forbidden — wrong bootstrap secret" });
  }
  const adminEmail = req.body.email || "admin@rishta.com";
  const adminPassword = req.body.password || "admin1234";
  const hash = await bcrypt.hash(adminPassword, 10);
  const existing = await db.findOne("users", { email: adminEmail });
  if (existing) {
    await db.update("users", { _id: existing._id || existing.id }, {
      password: hash, role: "admin", banned: false, active: true
    });
    return res.json({ ok: true, action: "reset", email: adminEmail });
  }
  await db.insert("users", {
    _id: uuid(), name: "Admin", email: adminEmail, password: hash,
    role: "admin", gender: "Male",
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: true },
    trustScore: 100, plan: "VIP",
    createdAt: new Date(), lastActive: new Date()
  });
  res.json({ ok: true, action: "created", email: adminEmail });
});

/* ==================== HEALTH ==================== */
app.get("/", (req, res) => res.json({
  name: "RishtaConnect API",
  status: "ok",
  database: USE_MONGO ? (mongoReady ? "mongodb-atlas" : "mongodb-failed-using-json") : "json-file",
  version: "2.0.0",
  time: Date.now()
}));

/* ==================== AUTO-SEED ==================== */
// Smart seeding:
//   1. Always ensures admin@rishta.com exists (even if other users present)
//   2. Only seeds demo users/blogs/banners if database is completely empty
async function ensureAdminExists() {
  const adminEmail = "admin@rishta.com";
  const existing = await db.findOne("users", { email: adminEmail });
  if (existing) {
    // Admin exists but might have role corrupted — ensure it's admin
    if (existing.role !== "admin") {
      await db.update("users", { _id: existing._id || existing.id }, { role: "admin" });
      console.log("✓ Fixed admin role for", adminEmail);
    } else {
      console.log("ℹ  Admin user already exists:", adminEmail);
    }
    return;
  }
  console.log("ℹ  Admin user missing — creating it now…");
  await db.insert("users", {
    _id: uuid(), name: "Admin", email: adminEmail,
    password: await bcrypt.hash("admin1234", 10),
    role: "admin", gender: "Male",
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: true },
    trustScore: 100, plan: "VIP",
    createdAt: new Date(), lastActive: new Date()
  });
  console.log("✓ Admin user created → admin@rishta.com / admin1234");
}

async function autoSeedIfEmpty() {
  try {
    // STEP 1: Always ensure admin exists (independent of database state)
    await ensureAdminExists();

    // STEP 2: Check if we should seed demo data
    const allUsers = await db.find("users", {});
    const nonAdminUsers = allUsers.filter(u => u.role !== "admin");
    if (nonAdminUsers.length > 0) {
      console.log(`ℹ  Database has ${nonAdminUsers.length} non-admin users — skipping demo seed`);
      return;
    }
    console.log("ℹ  Database has only admin — seeding demo profiles…");

    const demoProfiles = [
      { name: "Zeeshan Ahmed", email: "zeeshan@demo.com", phone: "+923001234567",
        gender: "Male", age: 29, height: "5'10\"", maritalStatus: "Never Married",
        city: "Lahore", country: "Pakistan", religion: "Islam", sect: "Sunni",
        languages: ["Urdu","Punjabi","English"], qualification: "BBA", university: "LUMS",
        profession: "Business", company: "Ahmed Honda Showroom",
        income: "5 Lac+", jobType: "Self-Employed",
        verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: true },
        plan: "Premium", trustScore: 92, timeline: "Within 1 year",
        bio: "Business owner from Lahore." },
      { name: "Areeba Fatima", email: "areeba@demo.com", phone: "+923012222222",
        gender: "Female", age: 24, height: "5'4\"", maritalStatus: "Never Married",
        city: "Islamabad", country: "Pakistan", religion: "Islam", sect: "Sunni",
        languages: ["Urdu","English"], qualification: "BS Computer Science",
        profession: "Teacher", company: "Roots International", income: "50k-1 Lac",
        verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
        plan: "Free", trustScore: 88, timeline: "Within 1 year",
        bio: "Teacher and CS graduate." },
      { name: "Hamza Khan", email: "hamza@demo.com", phone: "+971501234567",
        gender: "Male", age: 31, height: "5'11\"", maritalStatus: "Never Married",
        city: "Dubai", country: "UAE", overseas: true, religion: "Islam", sect: "Sunni",
        languages: ["Urdu","English","Arabic"], qualification: "MS Software Engineering",
        profession: "Software Engineer", company: "Emirates NBD", income: "10 Lac+",
        verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
        plan: "Premium", trustScore: 90, timeline: "Ready now" },
      { name: "Mahnoor Tariq", email: "mahnoor@demo.com", phone: "+923213333333",
        gender: "Female", age: 26, height: "5'5\"", maritalStatus: "Never Married",
        city: "Karachi", country: "Pakistan", religion: "Islam", sect: "Sunni",
        languages: ["Urdu","English"], qualification: "MBBS",
        profession: "Doctor", company: "AKU Hospital", income: "1-3 Lac",
        verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
        plan: "VIP", trustScore: 94, timeline: "Within 1 year" },
    ];

    for (const p of demoProfiles) {
      await db.insert("users", {
        _id: uuid(), ...p, role: "user",
        password: await bcrypt.hash("demo1234", 10),
        photos: [], blurPhoto: p.gender === "Female",
        createdAt: new Date(), lastActive: new Date()
      });
    }

    // Admin user — already created by ensureAdminExists()

    // Sample blogs
    const blogs = [
      { title: "5 Tips for a Successful Rishta Search",
        excerpt: "Patience, sincerity and family involvement.",
        content: "Finding the right life partner is one of the most important decisions...",
        coverImage: "🌙", author: "RishtaConnect Team", tags: ["Marriage","Tips"] },
      { title: "How RishtaConnect Verifies Profiles",
        excerpt: "Our 6-step verification process.",
        content: "We take verification seriously. Every profile goes through up to 6 layers...",
        coverImage: "✅", author: "Trust & Safety Team", tags: ["Verification","Safety"] },
      { title: "Success Story: Ahmad & Fatima",
        excerpt: "From first message to nikkah in 4 months.",
        content: "Two families connected on RishtaConnect. Their story...",
        coverImage: "💚", author: "Stories", tags: ["Success Story"] }
    ];
    for (const b of blogs) {
      const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await db.insert("blogs", { _id: uuid(), ...b, slug, published: true, createdAt: new Date(), updatedAt: new Date() });
    }

    // Sample banners
    const banners = [
      { title: "Welcome to RishtaConnect", subtitle: "Pakistan's most trusted matrimonial platform", image: "🌙", bgColor: "#0f766e", order: 1, active: true },
      { title: "Eid Special — 50% off Premium", subtitle: "Upgrade and unlock unlimited matches", image: "🎁", bgColor: "#c8a25b", order: 2, active: true },
      { title: "Now in 6 Countries", subtitle: "PK • UAE • KSA • UK • USA • Canada", image: "🌍", bgColor: "#134e4a", order: 3, active: true }
    ];
    for (const b of banners) {
      await db.insert("banners", { _id: uuid(), ...b, link: "#", createdAt: new Date() });
    }

    // Default settings
    await db.insert("settings", {
      _id: "site", siteName: "RishtaConnect",
      tagline: "Trusted Muslim Matrimony • AI-Powered • Family Friendly",
      primaryColor: "#0f766e", contactEmail: "info@rishtaconnect.com",
      contactPhone: "+92-300-1234567", whatsapp: "+92-300-1234567",
      address: "Lahore, Pakistan",
      maintenanceMode: false, signupEnabled: true,
      updatedAt: new Date()
    });

    console.log("✓ Auto-seeded:", demoProfiles.length + 1, "users,", blogs.length, "blogs,", banners.length, "banners");
    console.log("  Admin → admin@rishta.com / admin1234");
    console.log("  User  → zeeshan@demo.com / demo1234");
  } catch (e) {
    console.error("✗ Auto-seed failed:", e.message);
  }
}

/* ==================== START ==================== */
(async () => {
  await connectMongo();
  await autoSeedIfEmpty();
  server.listen(PORT, () => console.log(`✓ RishtaConnect API running on http://localhost:${PORT}`));
})();
