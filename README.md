# RishtaConnect — Free Full-Stack Marriage Bureau Platform

A trusted, verified, AI-powered Muslim matrimonial platform for Pakistan and overseas families.
Built entirely with **free tools** — no paid services required to run or host.

> Stack: React (via CDN) • Node.js + Express • Socket.io • JSON DB (free) • Free hosting

---

## What's Included

### Frontend (React + Tailwind, single-file)
Located in `frontend/index.html`. Open directly in browser or host on Netlify/Vercel for free.

Pages built:
- Landing page (Hero + Features + Stats)
- Login / Signup with OTP
- Multi-step Biodata creation (7 steps)
- Home (AI Recommended + Verified Featured)
- Search with advanced filters
- Matches with compatibility score
- Profile detail (full biodata view)
- Real-time Chat / Messenger
- Verification Center (CNIC, Face, Family, Business)
- Trust Score system
- Subscription plans (Free / Premium / VIP)
- Family Dashboard
- Notifications
- Admin Panel (Users, Pending Edits, Reports, Fraud, Subs, Analytics)
- Bilingual UI (English + Urdu)

### Backend (Node.js + Express)
Located in `backend/`.

Endpoints:
- `POST /api/auth/signup` — create account
- `POST /api/auth/login` — JWT-based login
- `POST /api/auth/otp/send` & `verify`
- `GET /api/me` & `PUT /api/me` (sensitive edits → pending admin review)
- `GET /api/users?q=&city=&verified=…` — search with filters
- `GET /api/matches` — AI-ranked compatibility list
- `POST /api/interest/:to` — send interest
- `GET/POST /api/messages/:other` — chat
- `POST /api/verify/:type` — phone/email/cnic/face/family/business
- `POST /api/subscribe` — upgrade plan
- `POST /api/report/:user` — report abuse
- `GET /api/admin/edits` & approve/reject
- `GET /api/admin/reports`
- `POST /api/admin/users/:id/ban`
- `GET /api/admin/analytics`
- Real-time: Socket.io for messages + typing indicator

Built-in security:
- JWT authentication
- bcrypt password hashing
- helmet (security headers)
- express-rate-limit (DDoS protection)
- AI fraud detection (duplicate CNIC, multi-account device)
- Sensitive edit review workflow
- Trust score auto-computation

---

## Quick Start (Local — Free)

### 1. Run frontend (just open it!)
```bash
# Option A: Just open in browser
open frontend/index.html

# Option B: Serve with any static server
cd frontend
python3 -m http.server 8080
# Visit http://localhost:8080
```
The frontend works **fully standalone** using localStorage as a mock DB — perfect for demos.

### 2. Run backend (optional, for real persistence)
```bash
cd backend
npm install
node seed.js        # adds demo Pakistani profiles + admin
npm start           # API runs on http://localhost:4000
```
Demo credentials:
- Admin → `admin@rishta.com` / `admin1234`
- User → `zeeshan@demo.com` / `demo1234`

---

## Free Deployment Guide

### Frontend (Static, free forever)
**Option 1: Netlify**
1. Sign up at netlify.com (free)
2. Drag-and-drop the `frontend/` folder into Netlify dashboard
3. Done — you get a free `*.netlify.app` URL

**Option 2: Vercel**
1. `npm i -g vercel`
2. `cd frontend && vercel`
3. Free `*.vercel.app` URL

**Option 3: GitHub Pages**
1. Push to GitHub repo
2. Settings → Pages → Source: `main /frontend`

### Backend (Free tier)
**Option 1: Render.com (recommended)**
1. Push backend to GitHub
2. render.com → New Web Service → Connect repo
3. Build: `npm install` • Start: `node server.js`
4. Free 750 hrs/month

**Option 2: Railway.app**
1. railway.app → New Project from GitHub
2. Free $5 credit/month

**Option 3: Fly.io**
1. `fly launch` from `backend/` folder
2. Free tier available

After backend is deployed, update the frontend's API URL.

---

## Upgrade Path (When You're Ready)

| Demo (free) | Production (paid/free tier) |
|---|---|
| JSON file DB | MongoDB Atlas (free 512 MB) or Supabase Postgres (free) |
| localStorage | Real backend (already built!) |
| Avatar SVGs | Cloudinary (free 25 GB) for photo uploads |
| Hardcoded OTP `123456` | Twilio SMS (free trial $15) or Firebase Phone Auth (free) |
| Mock AI matching | OpenAI API for smarter recommendations |
| No payments | Stripe (no monthly fee, 2.9% per txn) + Easypaisa/JazzCash |
| Single server | Cloudflare CDN (free) + serverless functions |

---

## Tech Notes

- **No build step needed** — frontend uses React via CDN + Babel standalone
- **No database server needed** — backend uses simple JSON file (`db.json`)
- **Mobile-first responsive** — works on phone, tablet, desktop
- **PWA-ready** — can add manifest.json for "Install to Home Screen"

---

## Features Implemented (from your spec)

✅ Email/Phone signup + OTP + 2FA UI
✅ A-Z biodata (personal, education, family, religion, personality, preferences)
✅ Blurred photo mode
✅ Verification system (Phone, Email, CNIC, Face, Family, Business)
✅ Trust Score with auto-computation (+20 CNIC, +20 face, etc.)
✅ AI Fraud Detection (duplicate CNIC, multi-device, flagging)
✅ Profile Edit Review System (sensitive changes → admin approval)
✅ Real-time Messenger (Socket.io, voice/file buttons, typing)
✅ Privacy (blur photos, hidden phone, family-only mode)
✅ Family accounts & approval workflow
✅ AI Matching with compatibility score
✅ Advanced search & filters
✅ Subscription tiers (Free / Premium / VIP)
✅ Payment methods UI (Stripe, PayPal, JazzCash, Easypaisa, Apple/Google Pay)
✅ Family Meeting Scheduler UI
✅ Voice/Video introduction placeholders
✅ Admin Panel (Users, Edits, Reports, Fraud, Subs, Analytics)
✅ Moderation (Report, Warn, Restrict, Ban)
✅ Notifications
✅ 6 country support (Pakistan, UAE, KSA, UK, USA, Canada)
✅ Demo Pakistani profiles seeded
✅ Bilingual UI (English + Urdu)
✅ Marriage timeline (Ready now / Within 1 year / Just exploring)
✅ Secure contact reveal (mutual interest or Premium)

---

## License

MIT — free to use, modify, deploy.
Built as a starter foundation. Add your own AI provider, payment gateway, and SMS provider for production.
