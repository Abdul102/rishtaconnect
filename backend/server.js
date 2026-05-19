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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

/* ==================== DATABASE LAYER ==================== */
// Mode: MongoDB if MONGO_URI is set, else JSON file
const USE_MONGO = !!MONGO_URI;
let mongoReady = false;
const DB_PATH = path.join(__dirname, "db.json");

const collections = [
  "users", "blogs", "banners", "contacts", "settings", "interests", "reports",
  "pendingEdits", "subscriptions", "activityLogs",
  // New collections for advanced features
  "profileViews", "superLikes", "boosts", "stories", "successStories",
  "blocks", "fraudFlags", "presence", "messageReads", "credits"
];
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
  caste: String, whatsappNumber: String, addedBy: String, importSource: String,
  mustChangePassword: Boolean, avatarType: String, urduMeta: Object,
  lastActive: { type: Date, default: Date.now }, createdAt: { type: Date, default: Date.now }
}, { _id: false, strict: false });

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
  // Advanced feature models
  M.ProfileView = mongoose.model("ProfileView", SimpleSchema("profileViews"));
  M.SuperLike = mongoose.model("SuperLike", SimpleSchema("superLikes"));
  M.Boost = mongoose.model("Boost", SimpleSchema("boosts"));
  M.Story = mongoose.model("Story", SimpleSchema("stories"));
  M.SuccessStory = mongoose.model("SuccessStory", SimpleSchema("successStories"));
  M.Block = mongoose.model("Block", SimpleSchema("blocks"));
  M.FraudFlag = mongoose.model("FraudFlag", SimpleSchema("fraudFlags"));
  M.Presence = mongoose.model("Presence", SimpleSchema("presence"));
  M.MessageRead = mongoose.model("MessageRead", SimpleSchema("messageReads"));
  M.Credit = mongoose.model("Credit", SimpleSchema("credits"));
}

/* ---- JSON file fallback ---- */
function loadJSONDB() {
  if (!fs.existsSync(DB_PATH)) {
    const seed = {
      users: [], blogs: [], banners: [], contacts: [],
      settings: [{ _id: "site", siteName: "RishtaConnect" }],
      messages: {}, interests: [], reports: [], pendingEdits: [], subscriptions: [], activityLogs: [],
      profileViews: [], superLikes: [], boosts: [], stories: [], successStories: [],
      blocks: [], fraudFlags: [], presence: [], messageReads: [], credits: []
    };
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
    activityLogs: M.ActivityLog, messages: M.Message,
    profileViews: M.ProfileView, superLikes: M.SuperLike, boosts: M.Boost,
    stories: M.Story, successStories: M.SuccessStory, blocks: M.Block,
    fraudFlags: M.FraudFlag, presence: M.Presence,
    messageReads: M.MessageRead, credits: M.Credit
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
  const { password, pinCode, ...rest } = u;
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
    const { email, password, phone } = req.body;
    let user = null;
    if (email) user = await db.findOne("users", { email });
    if (!user && phone) {
      // Try phone-based login (for imported users with no email)
      const normalized = normalizePhone(phone);
      const all = await db.find("users", {});
      user = all.find(u => normalizePhone(u.phone || u.whatsappNumber) === normalized);
    }
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });
    if (user.banned) return res.status(403).json({ error: "Account banned" });
    await db.update("users", { _id: user._id || user.id }, { lastActive: new Date() });
    const token = jwt.sign({ id: user._id || user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: sanitize(user),
      mustChangePassword: !!user.mustChangePassword
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Change password — used for first-login forced change + general password updates
app.post("/api/auth/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
    const user = await db.findOne("users", { _id: req.user.id });
    if (!user) return res.status(404).json({ error: "Not found" });
    // For forced first-time change, current may not be required if mustChangePassword === true and the user signs in with default password
    if (currentPassword) {
      const ok = await bcrypt.compare(currentPassword, user.password || "");
      if (!ok) return res.status(400).json({ error: "Current password is incorrect" });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await db.update("users", { _id: req.user.id }, {
      password: hash, mustChangePassword: false, passwordChangedAt: new Date()
    });
    res.json({ ok: true, message: "Password updated successfully" });
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

// Deep equality for arrays/objects (used to avoid flagging unchanged fields as "changed")
function deepEq(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

app.put("/api/me", auth, async (req, res) => {
  const user = await db.findOne("users", { _id: req.user.id });
  if (!user) return res.status(404).json({ error: "Not found" });

  // Photos are NOT sensitive — users can re-upload freely (no admin review).
  // Sensitive identity/finance fields still require admin review.
  const sensitive = ["name", "age", "income", "city", "maritalStatus", "phone"];
  const banned = new Set(["_id", "id", "password", "role", "email", "trustScore", "verifications", "banned", "createdAt"]);
  const changes = {};
  const directUpdates = {};
  Object.keys(req.body).forEach(k => {
    if (banned.has(k)) return;
    const newVal = req.body[k];
    const oldVal = user[k];
    if (deepEq(oldVal, newVal)) return; // skip unchanged
    if (sensitive.includes(k)) {
      changes[k] = { old: oldVal, new: newVal };
    } else {
      directUpdates[k] = newVal;
    }
  });

  if (Object.keys(changes).length) {
    await db.insert("pendingEdits", {
      _id: uuid(), userId: req.user.id, changes,
      status: "pending", createdAt: new Date()
    });
  }
  if (Object.keys(directUpdates).length) {
    directUpdates.trustScore = computeTrustScore({ ...user, ...directUpdates });
    directUpdates.updatedAt = new Date();
    await db.update("users", { _id: req.user.id }, directUpdates);
  }

  const updated = await db.findOne("users", { _id: req.user.id });
  res.json({
    user: sanitize(updated),
    pendingChanges: Object.keys(changes).length,
    appliedChanges: Object.keys(directUpdates).filter(k => k !== "trustScore" && k !== "updatedAt").length,
    message: Object.keys(changes).length
      ? "Saved. Sensitive fields are pending admin review."
      : "Profile updated."
  });
});

/* ==================== BULK USER IMPORT (Admin) ==================== */
// Urdu → English mapping for common fields
const URDU_MAP = {
  // Gender
  "لڑکا": "Male", "لڑکی": "Female", "مرد": "Male", "عورت": "Female",
  // Marital status
  "کنوارا": "Never Married", "کنواری": "Never Married",
  "شادی شدہ": "Married", "طلاق یافتہ": "Divorced", "مطلقہ": "Divorced",
  "رنڈوا": "Widowed", "بیوہ": "Widowed",
  // Sect
  "اہلسنت": "Sunni", "اہل سنت": "Sunni", "اہل تشیع": "Shia", "شیعہ": "Shia",
  // Job / business
  "جاب": "Job", "بزنس": "Business", "کاروبار": "Business",
  // Cities (Urdu name → English)
  "لاہور": "Lahore", "کراچی": "Karachi", "اسلام آباد": "Islamabad",
  "راولپنڈی": "Rawalpindi", "فیصل آباد": "Faisalabad", "ملتان": "Multan",
  "پشاور": "Peshawar", "کوئٹہ": "Quetta", "گوجرانوالہ": "Gujranwala",
  "سیالکوٹ": "Sialkot", "سرگودھا": "Sargodha", "ساہیوال": "Sahiwal",
  "بہاولپور": "Bahawalpur", "جھنگ": "Jhang", "قصور": "Kasur",
  "اوکاڑہ": "Okara", "وزیرآباد": "Wazirabad", "پتوکی": "Pattoki",
  "ٹوبہ ٹیک سنگھ": "Toba Tek Singh", "ایبٹ آباد": "Abbottabad",
  "وہاڑی": "Vehari", "بورے والا": "Burewala", "واہ کینٹ": "Wah Cantt",
  "منڈی بہاؤالدین": "Mandi Bahauddin", "لاپور": "Lahore",
};

function tr(v) {
  if (!v || typeof v !== "string") return v;
  const t = v.trim();
  return URDU_MAP[t] || t;
}

// Normalize phone to E.164 canonical form.
// - Pakistani 03xx/+92 → +92xxxxxxxxxx
// - Other international (+CC...) kept as +CC followed by digits
function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Detect international country code other than 92
  const intl = s.match(/^\+\s*(\d{1,3})\s*(.+)$/);
  if (intl) {
    const cc = intl[1];
    const rest = intl[2].replace(/\D/g, "");
    if (cc === "92") {
      const local = rest.startsWith("0") ? rest.slice(1) : rest;
      if (!/^\d{9,11}$/.test(local)) return null;
      return "+92" + local;
    }
    // Other countries — keep as +CC + digits, basic sanity 6-15 digits
    if (!/^\d{6,15}$/.test(rest)) return null;
    return "+" + cc + rest;
  }
  // No leading + → treat as Pakistan local
  let p = s.replace(/[^\d]/g, "");
  if (p.startsWith("92")) p = p.slice(2);
  else if (p.startsWith("0")) p = p.slice(1);
  if (!/^\d{9,11}$/.test(p)) return null;
  return "+92" + p;
}

function parseResidenceMarla(v) {
  if (!v) return null;
  const m = String(v).match(/(\d+)/);
  return m ? +m[1] + " Marla" : v;
}

// Map a raw JSON record (any of the two supported shapes) into our user document
function mapImportRecord(raw) {
  // Support both: flat record OR the {image_N: [...]} wrapped style
  const r = raw || {};
  const gender = tr(r.gender || r.Gender) || "Male";
  const maritalStatus = tr(r.marital_status || r.maritalStatus || r.Marital) || "Never Married";
  const sect = tr(r.sect || r.Sect) || "Sunni";
  const city = tr(r.city || r.City) || "";
  const job = tr(r.job_business || r.job || r.Job) || "";
  const phone = normalizePhone(r.phone_number || r.phone || r.whatsapp || r.whatsappNumber);
  const name = (r.name || "").toString().trim();
  // Generate a synthetic email from phone (since no email in imports)
  const phoneDigits = phone ? phone.replace(/\D/g, "") : null;
  const email = phoneDigits ? `imp_${phoneDigits}@rishta.import` : null;

  return {
    name: name || `User ${phone ? phone.slice(-4) : Math.random().toString(36).slice(-4)}`,
    email, phone,
    whatsappNumber: phone,
    gender,
    age: +r.age || null,
    height: r.height || "",
    maritalStatus,
    sect,
    religion: "Islam",
    caste: r.caste || "",
    city,
    country: "Pakistan",
    qualification: r.education || "",
    profession: job,
    income: r.monthly_income || "",
    fatherProfession: "",
    motherProfession: "",
    siblings: [r.brothers && `${r.brothers} brother${r.brothers > 1 ? "s" : ""}`, r.sisters && `${r.sisters} sister${r.sisters > 1 ? "s" : ""}`].filter(Boolean).join(", "),
    familyType: "Moderate",
    namaz: "",
    religiousLevel: "Moderate",
    nature: "",
    smoking: "No",
    bio: [
      name && `Assalamu Alaikum, I am ${name}.`,
      r.age && `${r.age} years old`,
      r.education && `holding ${r.education}`,
      city && `from ${tr(city)}`,
      job && `working as ${tr(job)}`,
      maritalStatus && maritalStatus.toLowerCase() !== "never married" && `Marital status: ${maritalStatus}`,
      "Looking for a respectful rishta inshaAllah."
    ].filter(Boolean).join(". "),
    photos: [],
    addedBy: "admin",
    importSource: "json_import",
    mustChangePassword: true,
    avatarType: gender === "Female" ? "default_female" : gender === "Male" ? "default_male" : "default_neutral",
    plan: "Free",
    trustScore: 55,
    verifications: { phone: false, email: false, cnic: false, face: false, family: false, business: false },
    urduMeta: {
      original_city: r.city,
      original_gender: r.gender,
      original_marital: r.marital_status,
      original_sect: r.sect,
      residence: parseResidenceMarla(r.residence_size),
      registration_date: r.registration_date || null,
      address: r.address || null,
    }
  };
}

// Flatten input: accept either flat array OR [{image_1:[...]}, {image_2:[...]}] style
function flattenImportData(input) {
  const arr = Array.isArray(input) ? input : [input];
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    // If the item itself looks like a profile (has name/phone/gender), take it directly
    if (item.phone_number || item.phone || item.name || item.gender) {
      out.push(item);
      continue;
    }
    // Else it's a wrapper {image_N: [...]}
    for (const k of Object.keys(item)) {
      if (Array.isArray(item[k])) out.push(...item[k]);
    }
  }
  return out;
}

const DEFAULT_IMPORT_PASSWORD = process.env.DEFAULT_IMPORT_PASSWORD || "RishtaConnect123";

// Admin: preview import without committing
app.post("/api/admin/import-users/preview", auth, adminOnly, async (req, res) => {
  try {
    const flat = flattenImportData(req.body?.data);
    const allUsers = await db.find("users", {});
    const phoneIndex = new Set(allUsers.map(u => normalizePhone(u.phone || u.whatsappNumber)).filter(Boolean));
    const seenPhones = new Set();
    const report = { totalIn: flat.length, valid: 0, invalid: 0, duplicates: 0, samples: [] };
    const result = [];
    for (const raw of flat) {
      const m = mapImportRecord(raw);
      if (!m.phone) { report.invalid++; result.push({ status: "invalid", reason: "Invalid phone", raw }); continue; }
      if (phoneIndex.has(m.phone) || seenPhones.has(m.phone)) { report.duplicates++; result.push({ status: "duplicate", phone: m.phone, name: m.name }); continue; }
      seenPhones.add(m.phone);
      report.valid++;
      result.push({ status: "ok", mapped: m });
    }
    report.samples = result.slice(0, 5);
    res.json({ report, count: result.length, willImport: report.valid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Core import logic — reusable by both endpoints
async function runImport(data, importerUserId) {
  const flat = flattenImportData(data);
  const allUsers = await db.find("users", {});
  const phoneIndex = new Set(allUsers.map(u => normalizePhone(u.phone || u.whatsappNumber)).filter(Boolean));
  const hash = await bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
  let created = 0, skipped = 0, errors = [];
  const createdIds = [];
  for (const raw of flat) {
    try {
      const m = mapImportRecord(raw);
      if (!m.phone) { skipped++; continue; }
      if (phoneIndex.has(m.phone)) { skipped++; continue; }
      phoneIndex.add(m.phone);
      const user = { _id: uuid(), ...m, password: hash, role: "user", createdAt: new Date(), lastActive: new Date() };
      await db.insert("users", user);
      createdIds.push(user._id);
      created++;
    } catch (e) {
      errors.push({ name: raw?.name, error: e.message });
    }
  }
  if (importerUserId) {
    await db.insert("activityLogs", {
      _id: uuid(), userId: importerUserId, type: "bulk_import",
      details: { created, skipped, errors: errors.length }, time: new Date()
    });
  }
  return {
    ok: true, created, skipped, errorCount: errors.length, errors: errors.slice(0, 5),
    defaultPassword: DEFAULT_IMPORT_PASSWORD,
    createdIds: createdIds.slice(0, 20),
    message: `Imported ${created} users. Skipped ${skipped} (duplicates/invalid). Default password: ${DEFAULT_IMPORT_PASSWORD}`
  };
}

// Admin: commit import
app.post("/api/admin/import-users", auth, adminOnly, async (req, res) => {
  try {
    const result = await runImport(req.body?.data, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public: admin-added profiles section
app.get("/api/admin-added-users", auth, async (req, res) => {
  const list = (await db.find("users", { addedBy: "admin" }))
    .filter(u => !u.banned && u.role !== "admin")
    .map(u => ({ ...sanitize(u), password: undefined }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// Bootstrap: one-shot import from backend/seed-users.json (idempotent — skips dupes)
app.post("/api/admin/bootstrap-import", auth, adminOnly, async (req, res) => {
  try {
    const seedPath = path.join(__dirname, "seed-users.json");
    if (!fs.existsSync(seedPath)) return res.status(404).json({ error: "seed-users.json not shipped with backend" });
    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    const result = await runImport(data, req.user.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---- Dedicated photo upload endpoint (always immediate, no admin review) ---- */
app.put("/api/me/photos", auth, async (req, res) => {
  const user = await db.findOne("users", { _id: req.user.id });
  if (!user) return res.status(404).json({ error: "Not found" });
  const photos = Array.isArray(req.body.photos) ? req.body.photos.slice(0, 6) : [];
  // Sanity: must be data URLs or http URLs
  const valid = photos.filter(p => typeof p === "string" && (p.startsWith("data:image/") || p.startsWith("http")));
  await db.update("users", { _id: req.user.id }, { photos: valid, updatedAt: new Date() });
  const updated = await db.findOne("users", { _id: req.user.id });
  // Recompute trust score (photo presence can affect score)
  await db.update("users", { _id: req.user.id }, { trustScore: computeTrustScore(updated) });
  const final = await db.findOne("users", { _id: req.user.id });
  res.json({ user: sanitize(final), message: "Photos updated." });
});

/* ==================== SEARCH / MATCH ==================== */
app.get("/api/users", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  if (!me) return res.status(404).json({ error: "User not found" });
  const allUsers = await db.find("users", {});

  // Hide blocked users in either direction
  const blocks = await db.find("blocks", {});
  const blockedByMe = new Set(blocks.filter(b => b.blocker === (me._id || me.id)).map(b => b.blocked));
  const blockedMe = new Set(blocks.filter(b => b.blocked === (me._id || me.id)).map(b => b.blocker));

  // Admin sees all users (including admins/banned)
  // Regular users see EVERYONE except: self, banned, admin role, blocked
  let list;
  if (me.role === "admin") {
    list = allUsers.filter(u => (u._id || u.id) !== (me._id || me.id));
  } else {
    list = allUsers.filter(u => {
      const uid = u._id || u.id;
      if (uid === (me._id || me.id)) return false;
      if (u.banned || u.role === "admin") return false;
      if (blockedByMe.has(uid) || blockedMe.has(uid)) return false;
      if (u.invisibleMode && u.plan !== "Free") return false; // hidden in browse
      return true;
    });
  }

  const {
    city, country, profession, sect, verified, overseas, minAge, maxAge, q, gender,
    religiousLevel, category, maritalStatus, hijab, smoking, qualification
  } = req.query;
  if (gender) list = list.filter(u => u.gender === gender);
  if (city) list = list.filter(u => u.city === city);
  if (country) list = list.filter(u => u.country === country);
  if (profession) {
    const p = profession.toLowerCase();
    list = list.filter(u => (u.profession || "").toLowerCase().includes(p));
  }
  if (sect) list = list.filter(u => u.sect === sect);
  if (verified === "true") list = list.filter(u => u.verifications?.cnic);
  if (overseas === "true") list = list.filter(u => u.overseas || (u.country && u.country !== "Pakistan"));
  if (minAge) list = list.filter(u => u.age >= +minAge);
  if (maxAge) list = list.filter(u => u.age <= +maxAge);
  if (religiousLevel) list = list.filter(u => u.religiousLevel === religiousLevel);
  if (maritalStatus) list = list.filter(u => u.maritalStatus === maritalStatus);
  if (hijab) list = list.filter(u => u.hijab === hijab);
  if (smoking) list = list.filter(u => u.smoking === smoking);
  if (qualification) {
    const qual = qualification.toLowerCase();
    list = list.filter(u => (u.qualification || "").toLowerCase().includes(qual));
  }
  // Category filter — common matrimony segments
  if (category) {
    const cat = String(category).toLowerCase();
    list = list.filter(u => {
      const prof = (u.profession || "").toLowerCase();
      if (cat === "doctor") return /(doctor|md|mbbs|surgeon|physician)/.test(prof);
      if (cat === "ceo" || cat === "vip") return /(ceo|founder|director|owner)/.test(prof) || (u.plan === "VIP");
      if (cat === "business") return /(business|entrepreneur|owner)/.test(prof);
      if (cat === "religious") return u.religiousLevel === "Practising";
      if (cat === "divorcee") return u.maritalStatus === "Divorced";
      if (cat === "widow") return u.maritalStatus === "Widowed";
      return true;
    });
  }
  if (q) {
    const qq = q.toLowerCase();
    list = list.filter(u => ((u.name || "") + (u.city || "") + (u.profession || "")).toLowerCase().includes(qq));
  }

  list = list.map(u => {
    const boosted = u.boostedUntil && new Date(u.boostedUntil) > new Date();
    return {
      ...sanitize(u),
      email: me.role === "admin" ? u.email : undefined,
      phone: (me.role === "admin" || me.plan !== "Free") ? u.phone : undefined,
      score: compatibility(me, u),
      boosted
    };
  });
  // Sort: boosted profiles first, then by compatibility score
  list.sort((a, b) => {
    if (a.boosted && !b.boosted) return -1;
    if (!a.boosted && b.boosted) return 1;
    return (b.score || 0) - (a.score || 0);
  });

  // Free plan limit only for regular users
  if (me.role !== "admin" && me.plan === "Free") list = list.slice(0, 20);
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
// Send interest (or super like if ?super=1)
app.post("/api/interest/:to", auth, async (req, res) => {
  const fromId = req.user.id;
  const toId = req.params.to;
  if (fromId === toId) return res.status(400).json({ error: "Cannot send interest to yourself" });

  // Check duplicate
  const existing = await db.findOne("interests", { from: fromId, to: toId });
  if (existing && existing.status !== "rejected") {
    return res.status(400).json({ error: "Interest already sent", status: existing.status });
  }

  const isSuper = req.body?.superLike || req.query?.super === "1";
  // Super Like quota check: 1/day free, more requires credits
  if (isSuper) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLikes = (await db.find("superLikes", { from: fromId })).filter(s => new Date(s.createdAt) >= today);
    const me = await db.findOne("users", { _id: fromId });
    const credits = me?.superLikeCredits || 0;
    if (todayLikes.length >= 1 && credits <= 0) {
      return res.status(402).json({ error: "Daily super like used. Buy credits to send more.", needsCredits: true });
    }
    if (todayLikes.length >= 1 && credits > 0) {
      await db.update("users", { _id: fromId }, { superLikeCredits: credits - 1 });
    }
    await db.insert("superLikes", { _id: uuid(), from: fromId, to: toId, createdAt: new Date() });
  }

  const interest = {
    _id: uuid(), from: fromId, to: toId, status: "pending",
    superLike: !!isSuper, message: req.body?.message || "",
    createdAt: new Date()
  };
  await db.insert("interests", interest);
  io.to(toId).emit("interest", { from: fromId, superLike: isSuper });
  // Activity log on receiver side
  await db.insert("activityLogs", {
    _id: uuid(), userId: toId,
    type: isSuper ? "super_like" : "interest",
    icon: isSuper ? "⭐" : "💚",
    text: isSuper ? "Someone Super Liked you!" : "Someone sent you an interest",
    actorId: fromId, time: new Date()
  });
  res.json({ ok: true, id: interest._id, superLike: !!isSuper });
});

// Get my received & sent interests
app.get("/api/interests", auth, async (req, res) => {
  const me = req.user.id;
  const received = await db.find("interests", { to: me });
  const sent = await db.find("interests", { from: me });
  // Hydrate with user info
  const userIds = Array.from(new Set([...received.map(i => i.from), ...sent.map(i => i.to)]));
  const users = await Promise.all(userIds.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  res.json({
    received: received.map(i => ({ ...i, fromUser: userMap[i.from] })),
    sent: sent.map(i => ({ ...i, toUser: userMap[i.to] }))
  });
});

// Accept / Reject interest
app.post("/api/interests/:id/:action", auth, async (req, res) => {
  const { id, action } = req.params;
  if (!["accept", "reject"].includes(action)) return res.status(400).json({ error: "Invalid action" });
  const interest = await db.findOne("interests", { _id: id });
  if (!interest) return res.status(404).json({ error: "Not found" });
  if (interest.to !== req.user.id) return res.status(403).json({ error: "Not your interest to respond" });
  const newStatus = action === "accept" ? "accepted" : "rejected";
  await db.update("interests", { _id: id }, { status: newStatus, respondedAt: new Date() });
  io.to(interest.from).emit("interest_response", { id, status: newStatus });
  // Activity log on sender side
  await db.insert("activityLogs", {
    _id: uuid(), userId: interest.from,
    type: "interest_" + newStatus,
    icon: newStatus === "accepted" ? "💚" : "❌",
    text: newStatus === "accepted" ? "Your interest was accepted! You're now connected." : "Your interest was declined.",
    actorId: req.user.id, time: new Date()
  });
  res.json({ ok: true, status: newStatus });
});

// Connection status helper used in profile detail to show Connected badge
app.get("/api/connection/:other", auth, async (req, res) => {
  const me = req.user.id, other = req.params.other;
  const sent = await db.findOne("interests", { from: me, to: other });
  const recv = await db.findOne("interests", { from: other, to: me });
  let status = "none";
  if (sent?.status === "accepted" || recv?.status === "accepted") status = "connected";
  else if (sent?.status === "pending") status = "sent";
  else if (recv?.status === "pending") status = "incoming";
  else if (sent?.status === "rejected") status = "rejected_by_them";
  else if (recv?.status === "rejected") status = "rejected_by_me";
  res.json({ status, sentId: sent?._id, receivedId: recv?._id });
});

/* ==================== PROFILE VIEWS (Who Viewed Me) ==================== */
app.post("/api/view/:user", auth, async (req, res) => {
  const me = req.user.id, target = req.params.user;
  if (me === target) return res.json({ ok: true, self: true });
  // Dedupe by day per viewer-target pair
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const existing = (await db.find("profileViews", { viewer: me, target }))
    .find(v => new Date(v.createdAt) >= today);
  if (!existing) {
    await db.insert("profileViews", { _id: uuid(), viewer: me, target, createdAt: new Date() });
    io.to(target).emit("profile_viewed", { viewer: me });
  }
  res.json({ ok: true });
});

app.get("/api/views/me", auth, async (req, res) => {
  // Who viewed me — latest first
  const views = (await db.find("profileViews", { target: req.user.id }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // De-dupe by viewer, keep latest
  const seen = new Set(); const unique = [];
  for (const v of views) { if (!seen.has(v.viewer)) { seen.add(v.viewer); unique.push(v); } }
  const users = await Promise.all([...seen].map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  const me = await db.findOne("users", { _id: req.user.id });
  const blurred = me?.plan === "Free"; // Free users see blurred avatars
  res.json({
    count: unique.length,
    viewers: unique.slice(0, 100).map(v => ({
      viewer: userMap[v.viewer], viewedAt: v.createdAt, blurred
    }))
  });
});

app.get("/api/likes/me", auth, async (req, res) => {
  // Who sent me interest (pending = "liked me")
  const interests = (await db.find("interests", { to: req.user.id }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const userIds = [...new Set(interests.map(i => i.from))];
  const users = await Promise.all(userIds.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  const me = await db.findOne("users", { _id: req.user.id });
  const blurred = me?.plan === "Free";
  res.json({
    count: interests.length,
    likers: interests.slice(0, 100).map(i => ({
      user: userMap[i.from], superLike: !!i.superLike, status: i.status,
      likedAt: i.createdAt, blurred
    }))
  });
});

/* ==================== PROFILE BOOST ==================== */
app.post("/api/boost", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  if (!me) return res.status(404).json({ error: "Not found" });
  const credits = me.boostCredits || 0;
  if (credits <= 0 && me.plan === "Free") {
    return res.status(402).json({ error: "No boost credits. Upgrade to Premium or buy credits.", needsCredits: true });
  }
  const duration = 24 * 60 * 60 * 1000; // 24 hours
  const expiresAt = new Date(Date.now() + duration);
  await db.insert("boosts", { _id: uuid(), userId: req.user.id, startedAt: new Date(), expiresAt, plan: me.plan });
  if (credits > 0) {
    await db.update("users", { _id: req.user.id }, { boostCredits: credits - 1 });
  }
  await db.update("users", { _id: req.user.id }, { boostedUntil: expiresAt });
  res.json({ ok: true, expiresAt });
});

// Daily matches — picks freshest active matches once per day, cached client-side
app.get("/api/daily-matches", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  if (!me) return res.status(404).json({ error: "Not found" });
  const all = await db.find("users", {});
  const myId = me._id || me.id;
  // Exclude self, banned, admin, already-interested
  const myInterests = await db.find("interests", { from: myId });
  const sentSet = new Set(myInterests.map(i => i.to));
  const list = all
    .filter(u => (u._id || u.id) !== myId && !u.banned && u.role !== "admin" && !sentSet.has(u._id || u.id))
    .map(u => ({ ...sanitize(u), email: undefined, phone: undefined, score: compatibility(me, u) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  res.json({ matches: list, generatedAt: new Date() });
});

/* ==================== AI DREAM PARTNER GENERATOR ==================== */
// Parses natural-language wishes ("tall doctor religious overseas under 30")
// and scores users by attribute overlap. No external LLM required.
app.post("/api/dream-partner", auth, async (req, res) => {
  const me = await db.findOne("users", { _id: req.user.id });
  const text = String(req.body?.text || "").toLowerCase().trim();
  if (!text) return res.status(400).json({ error: "Describe your dream partner in a few words" });

  // Heuristic keyword extraction
  const wants = {
    profession: [],
    religiousLevel: null,
    sect: null,
    overseas: null,
    maxAge: null,
    minAge: null,
    city: null,
    country: null,
    heightTall: false,
    hijab: null,
    smoking: null,
    qualification: null,
  };
  const PROFESSIONS = ["doctor", "engineer", "teacher", "lawyer", "businessman", "businesswoman", "ceo", "manager", "designer", "developer", "nurse", "pilot", "accountant"];
  PROFESSIONS.forEach(p => { if (text.includes(p)) wants.profession.push(p); });
  if (/\bsunni\b/.test(text)) wants.sect = "Sunni";
  if (/\bshia\b/.test(text)) wants.sect = "Shia";
  if (/(religious|practising|hafiz|alim|maulvi)/.test(text)) wants.religiousLevel = "Practising";
  if (/(moderate|liberal)/.test(text)) wants.religiousLevel = "Moderate";
  if (/(overseas|abroad|foreign|usa|uk|canada|dubai|saudi|germany|australia)/.test(text)) wants.overseas = true;
  const ageMax = text.match(/under (\d{2})/) || text.match(/below (\d{2})/) || text.match(/max (\d{2})/);
  if (ageMax) wants.maxAge = +ageMax[1];
  const ageMin = text.match(/above (\d{2})/) || text.match(/over (\d{2})/) || text.match(/min (\d{2})/);
  if (ageMin) wants.minAge = +ageMin[1];
  if (/(tall|6 feet|6ft)/.test(text)) wants.heightTall = true;
  if (/hijab/.test(text)) wants.hijab = "Yes";
  if (/non.?smoker|no smoke/.test(text)) wants.smoking = "No";
  if (/(masters|mba|phd|doctorate|bachelor)/.test(text)) wants.qualification = text.match(/(masters|mba|phd|doctorate|bachelor)/)[1];

  // Pakistani city hints
  ["karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "multan", "faisalabad", "quetta"].forEach(c => {
    if (text.includes(c)) wants.city = c[0].toUpperCase() + c.slice(1);
  });
  // Countries
  ["pakistan", "usa", "uk", "canada", "dubai", "uae", "saudi arabia", "australia", "germany"].forEach(c => {
    if (text.includes(c)) wants.country = c.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  });

  const all = await db.find("users", {});
  const myId = me?._id || me?.id;
  // Opposite-gender, not banned, not self
  const wantGender = me?.gender === "Male" ? "Female" : me?.gender === "Female" ? "Male" : null;
  let candidates = all.filter(u =>
    (u._id || u.id) !== myId && !u.banned && u.role !== "admin"
    && (!wantGender || u.gender === wantGender)
  );

  // Score each candidate
  const scored = candidates.map(u => {
    let score = 0;
    const reasons = [];
    if (wants.profession.length && u.profession) {
      const p = String(u.profession).toLowerCase();
      const hit = wants.profession.find(x => p.includes(x));
      if (hit) { score += 25; reasons.push("Profession: " + u.profession); }
    }
    if (wants.sect && u.sect === wants.sect) { score += 15; reasons.push("Sect: " + u.sect); }
    if (wants.religiousLevel && u.religiousLevel === wants.religiousLevel) { score += 15; reasons.push("Religious: " + u.religiousLevel); }
    if (wants.overseas === true && (u.overseas || (u.country && u.country !== "Pakistan"))) { score += 18; reasons.push("Overseas: " + (u.country || "yes")); }
    if (wants.maxAge && u.age && u.age <= wants.maxAge) { score += 10; reasons.push("Age ≤ " + wants.maxAge); }
    if (wants.minAge && u.age && u.age >= wants.minAge) { score += 10; reasons.push("Age ≥ " + wants.minAge); }
    if (wants.city && u.city === wants.city) { score += 12; reasons.push("City: " + u.city); }
    if (wants.country && u.country === wants.country) { score += 12; reasons.push("Country: " + u.country); }
    if (wants.heightTall && u.height && /[6-7]/.test(u.height)) { score += 8; reasons.push("Tall"); }
    if (wants.hijab && u.hijab === wants.hijab) { score += 8; reasons.push("Hijab: " + u.hijab); }
    if (wants.smoking && u.smoking === wants.smoking) { score += 5; reasons.push("Smoking: " + u.smoking); }
    if (wants.qualification && u.qualification && u.qualification.toLowerCase().includes(wants.qualification)) {
      score += 10; reasons.push("Qualification");
    }
    // Add base compatibility score
    if (me) score += Math.floor(compatibility(me, u) / 5);
    return { ...sanitize(u), email: undefined, phone: undefined, dreamScore: score, dreamReasons: reasons };
  });

  scored.sort((a, b) => b.dreamScore - a.dreamScore);
  res.json({
    parsed: wants,
    matches: scored.slice(0, 10),
    total: scored.filter(s => s.dreamScore > 30).length
  });
});

/* ==================== STORIES (24hr expiry) ==================== */
app.post("/api/stories", auth, async (req, res) => {
  const { media, caption, type } = req.body || {};
  if (!media || typeof media !== "string") return res.status(400).json({ error: "Media required" });
  const story = {
    _id: uuid(), userId: req.user.id, media, caption: caption || "",
    type: type || "image",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    viewers: []
  };
  await db.insert("stories", story);
  res.json({ ok: true, story });
});

app.get("/api/stories", auth, async (req, res) => {
  const all = await db.find("stories", {});
  const fresh = all.filter(s => new Date(s.expiresAt) > new Date());
  // Hydrate with author
  const userIds = [...new Set(fresh.map(s => s.userId))];
  const users = await Promise.all(userIds.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  // Group by author
  const grouped = userIds.map(uid => ({
    user: userMap[uid],
    stories: fresh.filter(s => s.userId === uid).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  })).filter(g => g.user);
  res.json(grouped);
});

app.post("/api/stories/:id/view", auth, async (req, res) => {
  const s = await db.findOne("stories", { _id: req.params.id });
  if (!s) return res.json({ ok: false });
  const viewers = Array.isArray(s.viewers) ? s.viewers : [];
  if (!viewers.includes(req.user.id)) {
    viewers.push(req.user.id);
    await db.update("stories", { _id: req.params.id }, { viewers });
  }
  res.json({ ok: true });
});

app.delete("/api/stories/:id", auth, async (req, res) => {
  const s = await db.findOne("stories", { _id: req.params.id });
  if (!s) return res.status(404).json({ error: "Not found" });
  if (s.userId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ error: "Not yours" });
  await db.remove("stories", { _id: req.params.id });
  res.json({ ok: true });
});

/* ==================== SUCCESS STORIES (couple stories) ==================== */
app.get("/api/success-stories", async (req, res) => {
  const list = (await db.find("successStories", {}))
    .filter(s => s.published !== false)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

app.post("/api/admin/success-stories", auth, adminOnly, async (req, res) => {
  const { title, story, coupleNames, photo, weddingDate, location } = req.body || {};
  const doc = { _id: uuid(), title, story, coupleNames, photo, weddingDate, location, published: true, createdAt: new Date() };
  await db.insert("successStories", doc);
  res.json(doc);
});

app.put("/api/admin/success-stories/:id", auth, adminOnly, async (req, res) => {
  await db.update("successStories", { _id: req.params.id }, req.body);
  res.json({ ok: true });
});

app.delete("/api/admin/success-stories/:id", auth, adminOnly, async (req, res) => {
  await db.remove("successStories", { _id: req.params.id });
  res.json({ ok: true });
});

/* ==================== BLOCK / PRIVACY ==================== */
app.post("/api/block/:user", auth, async (req, res) => {
  if (req.params.user === req.user.id) return res.status(400).json({ error: "Cannot block yourself" });
  const existing = await db.findOne("blocks", { blocker: req.user.id, blocked: req.params.user });
  if (existing) return res.json({ ok: true, already: true });
  await db.insert("blocks", { _id: uuid(), blocker: req.user.id, blocked: req.params.user, createdAt: new Date() });
  res.json({ ok: true });
});

app.delete("/api/block/:user", auth, async (req, res) => {
  await db.remove("blocks", { blocker: req.user.id, blocked: req.params.user });
  res.json({ ok: true });
});

app.get("/api/blocks", auth, async (req, res) => {
  const blocks = await db.find("blocks", { blocker: req.user.id });
  const ids = blocks.map(b => b.blocked);
  const users = await Promise.all(ids.map(id => db.findOne("users", { _id: id })));
  res.json(users.filter(Boolean).map(sanitize));
});

// Privacy settings: PIN lock, invisible mode, blur photos
app.put("/api/me/privacy", auth, async (req, res) => {
  const allowed = ["pinLock", "pinCode", "invisibleMode", "blurPhoto", "hideOnline", "hideLastSeen", "disappearingMessages"];
  const patch = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  await db.update("users", { _id: req.user.id }, patch);
  const u = await db.findOne("users", { _id: req.user.id });
  res.json({ user: sanitize(u) });
});

/* ==================== PRESENCE / ONLINE STATUS ==================== */
app.post("/api/presence/ping", auth, async (req, res) => {
  await db.update("users", { _id: req.user.id }, { lastActive: new Date() });
  res.json({ ok: true });
});

app.get("/api/presence/:user", auth, async (req, res) => {
  const u = await db.findOne("users", { _id: req.params.user });
  if (!u) return res.json({ online: false });
  if (u.hideOnline || u.hideLastSeen) return res.json({ online: false, hidden: true });
  const lastActive = u.lastActive ? new Date(u.lastActive) : null;
  const online = lastActive && (Date.now() - lastActive.getTime() < 2 * 60 * 1000); // 2 min window
  res.json({ online, lastActive });
});

/* ==================== MESSAGE READ RECEIPTS / TYPING ==================== */
app.post("/api/messages/:other/read", auth, async (req, res) => {
  const key = [req.user.id, req.params.other].sort().join("-");
  await db.update("messageReads", { user: req.user.id, partner: req.params.other }, {
    user: req.user.id, partner: req.params.other, readAt: new Date(), threadKey: key
  });
  // Upsert: if no row, insert it
  const existing = await db.findOne("messageReads", { user: req.user.id, partner: req.params.other });
  if (!existing) {
    await db.insert("messageReads", {
      _id: uuid(), user: req.user.id, partner: req.params.other,
      readAt: new Date(), threadKey: key
    });
  }
  io.to(req.params.other).emit("message_read", { reader: req.user.id, time: new Date() });
  res.json({ ok: true });
});

app.get("/api/messages/:other/read-status", auth, async (req, res) => {
  // When did the OTHER person last read messages from me?
  const r = await db.findOne("messageReads", { user: req.params.other, partner: req.user.id });
  res.json({ readAt: r?.readAt || null });
});

/* ==================== CREDITS / MONETIZATION ==================== */
app.get("/api/credits", auth, async (req, res) => {
  const u = await db.findOne("users", { _id: req.user.id });
  res.json({
    superLikeCredits: u?.superLikeCredits || 0,
    boostCredits: u?.boostCredits || 0,
    revealCredits: u?.revealCredits || 0,
  });
});

// Buy credits — admin verifies payment, this is the post-verify action
app.post("/api/admin/users/:id/credits", auth, adminOnly, async (req, res) => {
  const u = await db.findOne("users", { _id: req.params.id });
  if (!u) return res.status(404).json({ error: "Not found" });
  const patch = {};
  ["superLikeCredits", "boostCredits", "revealCredits"].forEach(k => {
    if (typeof req.body[k] === "number") {
      patch[k] = (u[k] || 0) + req.body[k];
    }
  });
  await db.update("users", { _id: req.params.id }, patch);
  res.json({ ok: true, patch });
});

/* ==================== FRAUD REPORTS (Admin) ==================== */
app.get("/api/admin/fraud-flags", auth, adminOnly, async (req, res) => {
  const flags = (await db.find("fraudFlags", {})).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const userIds = [...new Set(flags.map(f => f.userId))];
  const users = await Promise.all(userIds.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  res.json(flags.map(f => ({ ...f, user: userMap[f.userId] })));
});

app.post("/api/admin/fraud-flags/:id/resolve", auth, adminOnly, async (req, res) => {
  await db.update("fraudFlags", { _id: req.params.id }, { resolved: true, resolvedAt: new Date(), resolvedBy: req.user.id });
  res.json({ ok: true });
});

/* ==================== ADMIN: BOOSTS, ACTIVE STORIES ==================== */
app.get("/api/admin/boosts", auth, adminOnly, async (req, res) => {
  const all = await db.find("boosts", {});
  const active = all.filter(b => new Date(b.expiresAt) > new Date());
  const ids = active.map(b => b.userId);
  const users = await Promise.all(ids.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  res.json(active.map(b => ({ ...b, user: userMap[b.userId] })));
});

app.get("/api/admin/stories", auth, adminOnly, async (req, res) => {
  const stories = (await db.find("stories", {}))
    .filter(s => new Date(s.expiresAt) > new Date())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const ids = [...new Set(stories.map(s => s.userId))];
  const users = await Promise.all(ids.map(id => db.findOne("users", { _id: id })));
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u._id || u.id, sanitize(u)]));
  res.json(stories.map(s => ({ ...s, user: userMap[s.userId] })));
});

app.get("/api/messages/:other", auth, async (req, res) => {
  const key = [req.user.id, req.params.other].sort().join("-");
  res.json(await db.findMessages(key));
});

// Get list of all conversations (threads) for current user
app.get("/api/conversations", auth, async (req, res) => {
  const myId = req.user.id;
  try {
    let threads = [];
    if (USE_MONGO && mongoReady) {
      // Find all messages involving this user
      const msgs = await M.Message.find({ $or: [{ from: myId }, { to: myId }] }).sort({ time: 1 }).lean();
      const map = new Map();
      for (const m of msgs) {
        const partnerId = m.from === myId ? m.to : m.from;
        if (!partnerId) continue;
        if (!map.has(partnerId)) map.set(partnerId, { partnerId, lastMessage: m, unread: 0 });
        else map.get(partnerId).lastMessage = m;
      }
      // Hydrate with partner user info
      const partnerIds = Array.from(map.keys());
      const users = await M.User.find({ _id: { $in: partnerIds } }).lean();
      const usersById = Object.fromEntries(users.map(u => [u._id, u]));
      threads = partnerIds.map(pid => ({
        partner: usersById[pid] ? sanitize(usersById[pid]) : { _id: pid, name: "Unknown user" },
        lastMessage: map.get(pid).lastMessage
      }));
    } else {
      // JSON fallback
      const data = loadJSONDB();
      const partners = new Set();
      Object.entries(data.messages || {}).forEach(([key, msgs]) => {
        const [a, b] = key.split("-");
        if (a === myId) partners.add(b);
        else if (b === myId) partners.add(a);
      });
      for (const pid of partners) {
        const key = [myId, pid].sort().join("-");
        const msgs = data.messages[key] || [];
        const partner = (data.users || []).find(u => (u._id || u.id) === pid);
        threads.push({
          partner: partner ? sanitize(partner) : { _id: pid, name: "Unknown" },
          lastMessage: msgs[msgs.length - 1]
        });
      }
    }
    res.json(threads);
  } catch (e) {
    console.error("conversations endpoint:", e.message);
    res.status(500).json({ error: e.message });
  }
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

    // STEP 2: Ensure demo profiles exist if database is small (so browsing isn't empty)
    const allUsers = await db.find("users", {});
    const nonAdminCount = allUsers.filter(u => u.role !== "admin").length;
    // Check if our seed users exist
    const hasDemoUsers = allUsers.some(u => u.email === "zeeshan@demo.com");
    if (hasDemoUsers || nonAdminCount >= 6) {
      console.log(`ℹ  Database has ${nonAdminCount} non-admin users — skipping demo seed`);
      return;
    }
    console.log(`ℹ  Only ${nonAdminCount} non-admin users found — adding demo profiles for browsing variety…`);

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
