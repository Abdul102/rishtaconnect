/**
 * Seed RishtaConnect with demo data.
 * Works with both MongoDB Atlas and JSON file (auto-detects MONGO_URI).
 *
 * Run: node seed.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "";
const USE_MONGO = !!MONGO_URI;
const DB_PATH = path.join(__dirname, "db.json");

const profiles = [
  {
    name: "Zeeshan Ahmed", email: "zeeshan@demo.com", phone: "+923001234567",
    gender: "Male", age: 29, height: "5'10\"", maritalStatus: "Never Married",
    city: "Lahore", country: "Pakistan", nationality: "Pakistani",
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "Punjabi", "English"],
    qualification: "BBA", university: "LUMS", profession: "Business",
    company: "Ahmed Honda Showroom", business: "Honda Bikes Showroom (3 outlets)",
    income: "5 Lac+", jobType: "Self-Employed",
    fatherProfession: "Retired Banker", motherProfession: "Homemaker",
    siblings: "2 brothers, 1 sister", familyType: "Moderate Religious", ownHouse: true,
    familyBackground: "Respected business family from Lahore.",
    namaz: "Regular", religiousLevel: "Practising",
    nature: "Respectful, family-oriented", hobbies: ["Cricket", "Reading"], smoking: "No",
    preferences: { ageRange: "22-28", city: "Any in Pakistan", education: "Graduate+" },
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: true },
    plan: "Premium", trustScore: 92, timeline: "Within 1 year",
    bio: "Alhamdulillah, business owner from Lahore."
  },
  {
    name: "Areeba Fatima", email: "areeba@demo.com", phone: "+923012222222",
    gender: "Female", age: 24, height: "5'4\"", maritalStatus: "Never Married",
    city: "Islamabad", country: "Pakistan", nationality: "Pakistani",
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "English"],
    qualification: "BS Computer Science", university: "NUST",
    profession: "Teacher", company: "Roots International",
    income: "50k-1 Lac", jobType: "Full-Time",
    fatherProfession: "Govt Officer", motherProfession: "Homemaker",
    siblings: "1 elder sister, 1 younger brother",
    familyType: "Religious", ownHouse: true,
    namaz: "Regular", hijab: "Yes", religiousLevel: "Practising",
    nature: "Soft-spoken, caring", hobbies: ["Reading", "Cooking"], smoking: "No",
    preferences: { ageRange: "26-32", city: "Islamabad/Lahore" },
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
    plan: "Free", trustScore: 88, timeline: "Within 1 year",
    bio: "Teacher and CS graduate. Looking for a practising Muslim."
  },
  {
    name: "Hamza Khan", email: "hamza@demo.com", phone: "+971501234567",
    gender: "Male", age: 31, height: "5'11\"", maritalStatus: "Never Married",
    city: "Dubai", country: "UAE", overseas: true,
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "English", "Arabic"],
    qualification: "MS Software Engineering", profession: "Software Engineer",
    company: "Emirates NBD", income: "10 Lac+", jobType: "Full-Time",
    namaz: "Regular", religiousLevel: "Practising",
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
    plan: "Premium", trustScore: 90, timeline: "Ready now"
  },
  {
    name: "Mahnoor Tariq", email: "mahnoor@demo.com", phone: "+923213333333",
    gender: "Female", age: 26, height: "5'5\"", maritalStatus: "Never Married",
    city: "Karachi", country: "Pakistan",
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "English"],
    qualification: "MBBS", profession: "Doctor", company: "AKU Hospital",
    income: "1-3 Lac", jobType: "Full-Time",
    namaz: "Mostly regular", religiousLevel: "Moderate",
    verifications: { phone: true, email: true, cnic: true, face: true, family: true, business: false },
    plan: "VIP", trustScore: 94, timeline: "Within 1 year"
  },
  {
    name: "Bilal Sheikh", email: "bilal@demo.com", phone: "+14165551234",
    gender: "Male", age: 34, height: "6'0\"", maritalStatus: "Divorced (no kids)",
    city: "Toronto", country: "Canada", overseas: true,
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "English"],
    qualification: "MBA", profession: "Finance", company: "RBC Bank",
    income: "10 Lac+", jobType: "Full-Time",
    namaz: "Jumma + Eid", religiousLevel: "Moderate",
    verifications: { phone: true, email: true, cnic: false, face: true, family: true, business: false },
    plan: "Premium", trustScore: 85, timeline: "Ready now"
  },
  {
    name: "Sana Iqbal", email: "sana@demo.com", phone: "+923004444444",
    gender: "Female", age: 23, height: "5'3\"", maritalStatus: "Never Married",
    city: "Lahore", country: "Pakistan",
    religion: "Islam", sect: "Sunni", languages: ["Urdu", "Punjabi", "English"],
    qualification: "BS English Literature", profession: "Content Writer", company: "Freelance",
    income: "50k-1 Lac", jobType: "Freelance",
    namaz: "Regular", hijab: "Yes", religiousLevel: "Practising",
    verifications: { phone: true, email: true, cnic: true, face: false, family: true, business: false },
    plan: "Free", trustScore: 80, timeline: "Just exploring"
  }
];

const blogs = [
  {
    title: "5 Tips for a Successful Rishta Search",
    excerpt: "Patience, sincerity and family involvement — the three pillars of finding the right life partner.",
    content: "Finding the right life partner is one of the most important decisions in a Muslim's life. Here are 5 practical tips:\n\n1. Make sincere dua (prayer) — Allah is the best of planners.\n2. Involve your family early in the process.\n3. Be honest about your expectations and your reality.\n4. Verify before committing — meet families, ask questions, check references.\n5. Don't rush — barakah comes with patience.",
    coverImage: "🌙", author: "RishtaConnect Team",
    tags: ["Marriage", "Islam", "Tips"]
  },
  {
    title: "How RishtaConnect Verifies Profiles",
    excerpt: "Our 6-step verification process explained — CNIC, face match, family approval and more.",
    content: "We take verification seriously. Every profile on RishtaConnect goes through up to 6 layers of verification:\n\n• Phone OTP\n• Email confirmation\n• CNIC verification (front + back)\n• Face match with CNIC photo (AI-powered)\n• Family verification (live call)\n• Business documents (for entrepreneurs)\n\nVerified users get a higher Trust Score and appear more in search results.",
    coverImage: "✅", author: "Trust & Safety Team",
    tags: ["Verification", "Trust", "Safety"]
  },
  {
    title: "Success Story: Ahmad & Fatima — Married in 4 Months",
    excerpt: "From first message to nikkah — read how two families connected on RishtaConnect.",
    content: "Ahmad from Karachi and Fatima from Multan matched on RishtaConnect in January. Their families spoke within a week, and by April, they were married. 'The verified profiles gave us confidence' said Ahmad's mother. We pray Allah blesses their marriage and grants them sabr, mawaddah and rahmah.",
    coverImage: "💚", author: "RishtaConnect Stories",
    tags: ["Success Story", "Marriage"]
  }
];

const banners = [
  {
    title: "Welcome to RishtaConnect",
    subtitle: "Pakistan's most trusted verified matrimonial platform",
    image: "🌙", link: "#signup", bgColor: "#0f766e", order: 1, active: true
  },
  {
    title: "Eid Special Offer — 50% off Premium",
    subtitle: "Upgrade now and unlock unlimited matches",
    image: "🎁", link: "#subscription", bgColor: "#c8a25b", order: 2, active: true
  },
  {
    title: "Now Available in 6 Countries",
    subtitle: "Pakistan, UAE, KSA, UK, USA, Canada",
    image: "🌍", link: "#about", bgColor: "#134e4a", order: 3, active: true
  }
];

const settings = {
  _id: "site",
  siteName: "RishtaConnect",
  tagline: "Trusted Muslim Matrimony • AI-Powered • Family Friendly",
  primaryColor: "#0f766e",
  contactEmail: "info@rishtaconnect.com",
  contactPhone: "+92-300-1234567",
  whatsapp: "+92-300-1234567",
  address: "Lahore, Pakistan",
  facebook: "https://facebook.com/rishtaconnect",
  instagram: "https://instagram.com/rishtaconnect",
  twitter: "https://twitter.com/rishtaconnect",
  youtube: "https://youtube.com/@rishtaconnect",
  footerText: "© " + new Date().getFullYear() + " RishtaConnect — Trusted Muslim Matrimony Platform",
  maintenanceMode: false,
  signupEnabled: true
};

async function seedMongo() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB Atlas");

  // Define minimal schemas just for seeding
  const Mongo = (name) => mongoose.model(name, new mongoose.Schema({}, { strict: false }));
  const User = Mongo("User"), Blog = Mongo("Blog"), Banner = Mongo("Banner"), Setting = Mongo("Setting");

  // Clear & seed
  await User.deleteMany({});
  await Blog.deleteMany({});
  await Banner.deleteMany({});
  await Setting.deleteMany({});

  for (const p of profiles) {
    await User.create({
      _id: uuid(), ...p, role: "user",
      password: await bcrypt.hash("demo1234", 10),
      photos: [], blurPhoto: p.gender === "Female",
      createdAt: new Date(), lastActive: new Date()
    });
  }
  await User.create({
    _id: uuid(), name: "Admin", email: "admin@rishta.com",
    password: await bcrypt.hash("admin1234", 10),
    role: "admin", gender: "Male", verifications: {}, trustScore: 100, plan: "VIP"
  });

  for (const b of blogs) {
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await Blog.create({ _id: uuid(), ...b, slug, published: true, createdAt: new Date(), updatedAt: new Date() });
  }
  for (const b of banners) {
    await Banner.create({ _id: uuid(), ...b, createdAt: new Date() });
  }
  await Setting.create(settings);

  console.log("✓ Seeded", profiles.length + 1, "users,", blogs.length, "blogs,", banners.length, "banners");
  console.log("  Admin → admin@rishta.com / admin1234");
  console.log("  User  → zeeshan@demo.com / demo1234");
  await mongoose.disconnect();
}

async function seedJSON() {
  const db = {
    users: [], blogs: [], banners: [], contacts: [],
    settings: [settings], messages: {}, interests: [], reports: [],
    pendingEdits: [], subscriptions: [], activityLogs: []
  };
  for (const p of profiles) {
    db.users.push({
      _id: uuid(), ...p, role: "user",
      password: await bcrypt.hash("demo1234", 10),
      photos: [], blurPhoto: p.gender === "Female",
      createdAt: new Date(), lastActive: new Date()
    });
  }
  db.users.push({
    _id: uuid(), name: "Admin", email: "admin@rishta.com",
    password: await bcrypt.hash("admin1234", 10),
    role: "admin", gender: "Male", verifications: {}, trustScore: 100, plan: "VIP"
  });
  for (const b of blogs) {
    const slug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    db.blogs.push({ _id: uuid(), ...b, slug, published: true, createdAt: new Date(), updatedAt: new Date() });
  }
  for (const b of banners) {
    db.banners.push({ _id: uuid(), ...b, createdAt: new Date() });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log("✓ Seeded", db.users.length, "users to db.json");
  console.log("  Admin → admin@rishta.com / admin1234");
  console.log("  User  → zeeshan@demo.com / demo1234");
}

(async () => {
  try {
    if (USE_MONGO) await seedMongo();
    else await seedJSON();
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exit(1);
  }
})();
