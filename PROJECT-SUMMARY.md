# RishtaConnect — Full Project Summary

> **Purpose:** Yeh file ek complete reference hai. Future change requests mein full chat re-read karne ki zaroorat nahi — bas ye file aur relevant file padhne hai. Har feature/file/endpoint yahaan documented hai.

---

## 🌐 Live URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | https://rishtaconnect.vercel.app | Vercel (free) — static React |
| Backend API | https://rishtaconnect-production.up.railway.app | Railway (free $5/mo trial) |
| Database | MongoDB Atlas (cluster: `uz7lejv`) | `rishtaconnect` DB |
| GitHub | https://github.com/Abdul102/rishtaconnect | Source of truth |

**Credentials (after auto-seed):**
- Admin: `admin@rishta.com` / `admin1234`
- Demo Users: `zeeshan@demo.com`, `areeba@demo.com`, `hamza@demo.com`, `mahnoor@demo.com` / `demo1234`

---

## 📁 Project Structure

```
RishtaConnect/
├── frontend/
│   ├── index.html              ← SINGLE-FILE React app (190KB). ALL UI lives here.
│   ├── config.js               ← window.API_URL override (mostly unused — URL hardcoded in index.html)
│   └── vercel.json             ← Vercel routes config
├── backend/
│   ├── server.js               ← Express + MongoDB + Socket.io. All API endpoints.
│   ├── seed.js                 ← Standalone seed script
│   ├── package.json            ← Dependencies (mongoose, bcrypt, nodemailer, etc.)
│   ├── railway.json            ← Railway build config
│   ├── Procfile                ← `web: node server.js`
│   ├── .env                    ← Local dev secrets (gitignored)
│   └── .env.example            ← Template
├── DEPLOYMENT-GUIDE.md         ← Roman Urdu step-by-step
├── README.md                   ← Project overview
└── PROJECT-SUMMARY.md          ← This file
```

**Important:** Frontend is a **single HTML file** with React via CDN + Babel standalone. No build step. All components are JSX inside `<script type="text/babel">`.

---

## 🔧 Tech Stack

- **Frontend:** React 18 (CDN) + Babel standalone + Tailwind CSS (CDN) — no npm build
- **Backend:** Node.js + Express + Mongoose + Socket.io + bcryptjs + JWT + helmet + rate-limit + nodemailer
- **Database:** MongoDB Atlas (free 512MB) with JSON file fallback
- **Hosting:** Vercel (frontend, free) + Railway (backend, free trial)

---

## 🔑 Environment Variables (Railway Backend)

| Var | Purpose | Required |
|-----|---------|----------|
| `PORT` | Server port | Yes (Railway sets) |
| `JWT_SECRET` | JWT signing | Yes |
| `MONGO_URI` | MongoDB connection | Yes — without it falls back to JSON |
| `SMTP_HOST` | Email server (Gmail/SES) | Optional — for real OTP emails |
| `SMTP_PORT` | Usually 587 | Optional |
| `SMTP_SECURE` | `true` for 465, `false` for 587 | Optional |
| `SMTP_USER` | SMTP username | Optional |
| `SMTP_PASS` | SMTP app password | Optional |
| `NODE_ENV` | `production` to disable debug OTP return | Recommended |

Without SMTP, OTPs are logged to Railway console. With SMTP, real emails sent.

---

## 🎨 Frontend — `frontend/index.html`

**Single file structure** (line numbers approximate, search for `function ComponentName`):

### Constants & Helpers (lines ~150-400)
- `API_BASE` — Backend URL (hardcoded to Railway, fallback to localhost)
- `APIError`, `api(path, opts)`, `apiSilent(path, opts)` — fetch wrappers
- `STRINGS` — i18n EN/UR
- `cities`, `countries`, `sects`, `educations`, `professions`, `incomeRanges` — dropdowns
- `compatibility(a, b)` — match algo
- `uid()`, `timeAgo()` — utils

### Core Components (search by name in file)
| Component | What it does |
|-----------|-------------|
| `App` | Root. Routing via `view` state + hash. |
| `Landing` | Public homepage. Banner carousel, blogs, testimonials, pricing. |
| `AuthScreen` | Login/Signup with form validation + OTP step. |
| `ProfileSetup` | 7-step biodata wizard with validation + multi-photo upload. |
| `Home` | CRM-style user dashboard with real stats, activity feed. |
| `SearchView` | Backend-driven search with saved filter views. |
| `Matches` | AI-ranked from `/api/matches`. |
| `ProfileDetail` | Full bio modal with interest/message/WhatsApp buttons. |
| `ChatView` | Real conversations only — empty state for new users. |
| `VerificationView` | 6 verification types with trust score. |
| `Subscription` | Free/Premium/VIP with bank transfer + JazzCash payment. |
| `MyProfile` | Self profile with action tiles. |
| `Family` | Family dashboard. |
| `Notifications` | Real user-specific notifications only. |
| `EditHistory` | Profile edit pending/approved/rejected log. |
| `MatchmakersMarketplace` | Fiverr-style consultant marketplace (5 demo matchmakers). |
| `MatchmakerDashboard` | CRM pipeline (Lead → Married). |
| `Meetings` | Schedule meetings with auto-gen Google Meet/Zoom links. |
| `AdminLayout` | Separate dark sidebar admin shell. Route: `#/admin/*`. |
| `AdminContent` | Tab router inside AdminLayout. |
| `AdminUsersTab` | User table with ban/unban. (NEEDS deactivate, message, password reset — pending) |
| `AdminEditsTab` | Pending profile edits with Approve/Reject. |
| `AdminReportsTab` | User reports. |
| `AdminFraudTab` | Fraud alerts. |
| `AdminBlogs` | Blog CRUD. |
| `AdminBanners` | Banner CRUD with color picker. |
| `AdminContacts` | Contact form submissions inbox. |
| `AdminSettings` | Site name, logo, social links, etc. |
| `BlogSection`, `BlogModal`, `ContactSection`, `BannerCarousel` | Public landing widgets. |
| `Avatar` | SVG fallback OR real user photo. |
| `ProfileCard` | Card with photo, badges, compat score, WhatsApp button. |
| `CompatRing` | SVG circular progress. |
| `Stat`, `Stat2`, `DashCard`, `ActivityItem` | Small reusables. |
| `BottomNav`, `TopBar` | Bottom mobile nav (Home/Search/Hire/Chat/Profile) + top bar (with bell/message badges). |

### Routing
- `view` state controls main page: `landing`, `login`, `signup`, `setup`, `home`, `search`, `matches`, `chat`, `profile`, `verify`, `subscription`, `family`, `notifications`, `editHistory`, `matchmakers`, `meetings`, `matchmakerDashboard`, `admin`.
- Hash `#/admin/*` → AdminLayout takes over (only if user.role === "admin").
- Admin sub-routes: `#/admin/dashboard`, `#/admin/users`, `#/admin/edits`, `#/admin/reports`, `#/admin/fraud`, `#/admin/blogs`, `#/admin/banners`, `#/admin/contacts`, `#/admin/subs`, `#/admin/analytics`, `#/admin/settings`.

### State (React useState)
- `user` — logged-in user (null if guest)
- `users` — local cache (empty array — real users come from `/api/users` per view)
- `messages` — chat threads keyed `userA-userB`
- `unreadMsgs`, `unreadNotifs` — badge counters
- `lang` — "en" or "ur"
- `activeProfile` — modal user
- `view` — current page

### LocalStorage Keys
- `rishta_token` — JWT
- `rishta_state` — user/users/messages snapshot
- `rishta_filters` — last search filters
- `rishta_saved_views` — saved filter presets
- `rishta_viewed_profiles` — for "first 10 premium preview"
- `rishta_meetings_<userId>` — meeting list per user
- `rishta_hired_matchmakers` — hired consultants
- `rishta_pending_edit_<userId>` — pending biodata change
- `rishta_edit_history_<userId>` — edit log
- `rishta_activity_<userId>` — recent activity feed
- `rishta_my_views_<userId>` — who viewed this user
- `rishta_interests_received_<userId>` — interest count
- `rishta_welcome_shown_<userId>` — one-time welcome
- `rishta_contacts` — offline contact form drafts
- `rishta_blogs`, `rishta_banners`, `rishta_settings` — offline admin drafts

---

## 🔌 Backend — `backend/server.js`

### API Endpoints

**Auth:**
- `POST /api/auth/signup` — { name, email, phone, password, gender } → token + user
- `POST /api/auth/login` — { email, password } → token + user (401 if wrong)
- `POST /api/auth/otp/send` — { email, phone } → sends OTP (real, expires 10 min). Returns devOtp only if SMTP not configured.
- `POST /api/auth/otp/verify` — { email, phone, otp } → { ok: true/false, error? }

**Profile:**
- `GET /api/me` — current user
- `PUT /api/me` — update (sensitive fields → pending admin review)

**Users / Matches:**
- `GET /api/users?city=&minAge=...` — filtered list (Free plan limited to 10)
- `GET /api/matches` — AI-ranked

**Interest / Chat:**
- `POST /api/interest/:to`
- `GET /api/messages/:other`
- `POST /api/messages/:other` — { text }

**Verification:**
- `POST /api/verify/:type` (type: phone/email/cnic/face/family/business)

**Subscription:**
- `POST /api/subscribe` — { plan, txnId, method }

**Report:**
- `POST /api/report/:user` — { reason }

**Public CMS:**
- `GET /api/blogs`, `GET /api/blogs/:slug`
- `GET /api/banners`
- `GET /api/settings`
- `POST /api/contact` — { name, email, phone, subject, message }

**Admin (require auth + role=admin):**
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PUT /api/admin/users/:id` — update any field
- `DELETE /api/admin/users/:id` — hard delete
- `POST /api/admin/users/:id/ban` & `/unban`
- `POST /api/admin/users/:id/deactivate` & `/activate`
- `POST /api/admin/users/:id/reset-password` — { newPassword }
- `POST /api/admin/users/:id/message` — { text } (sends as admin)
- `GET /api/admin/edits` — pending profile edits
- `POST /api/admin/edits/:id/approve` & `/reject`
- `GET /api/admin/reports`
- `POST /api/admin/blogs`, `PUT /api/admin/blogs/:id`, `DELETE /api/admin/blogs/:id`
- `POST /api/admin/banners`, `PUT /api/admin/banners/:id`, `DELETE /api/admin/banners/:id`
- `GET /api/admin/contacts`, `PUT /api/admin/contacts/:id`, `DELETE /api/admin/contacts/:id`
- `PUT /api/admin/settings`
- `GET /api/admin/analytics`

### Backend Code Sections (line ranges approximate)
- 1-50: imports, app setup, helmet, cors, rate-limit
- 50-200: Mongoose schemas (User, Blog, Banner, Contact, Settings, Message)
- 200-300: `db` abstraction (works for both Mongo + JSON)
- 300-340: `auth`, `adminOnly`, `detectFraud`, `computeTrustScore`, `compatibility`, `sanitize`
- 340-420: Auth routes (signup, login, OTP send/verify)
- 420-460: Profile (GET/PUT /api/me)
- 460-510: Users + Matches
- 510-550: Interest + Chat
- 550-600: Verify, Subscribe, Report
- 600-680: Blog CRUD
- 680-740: Banner CRUD
- 740-790: Contact form + admin inbox
- 790-820: Settings
- 820-940: Admin operations (users, edits, reports, password reset, deactivate, admin message)
- 940-970: Socket.io setup
- 970-1100: Auto-seed function (runs on empty DB)
- 1100-end: Start server

### Auto-Seed (`autoSeedIfEmpty()`)
On startup, if `users` collection is empty:
- Adds 4 demo users + 1 admin
- Adds 3 sample blogs
- Adds 3 sample banners
- Adds default site settings

---

## 🚦 Major Features Status

| Feature | Status | File / Section |
|---------|--------|----------------|
| Strict auth (no fake login) | ✅ Done | `App.onAuth`, `AuthScreen` |
| Real OTP system (email + console) | ✅ Done | `server.js` `otp/send`, `otp/verify` |
| Form validation everywhere | ✅ Done | `AuthScreen.validateForm`, `ProfileSetup.validateStep` |
| Profile edit review (anti-fraud) | ✅ Done | `App.setup save handler`, `EditHistory`, `AdminEditsTab` |
| Multi-photo upload | ✅ Done | `ProfileSetup.onPhotoSelect` |
| Real-time chat (Socket.io) | ✅ Backend wired | `server.js` socket section, `ChatView` |
| Empty states (new user) | ✅ Done | `Home`, `ChatView`, `Notifications`, `Matches`, `Search` |
| Real backend data only | ✅ Done | All views use `apiSilent("/api/users")` |
| WhatsApp button | ✅ Done | `ProfileCard`, `ProfileDetail` |
| First-10-proposals premium preview | ✅ Done | `ProfileDetail` |
| Payment: bank + JazzCash | ✅ Done | `Subscription` |
| Matchmakers marketplace | ✅ Done | `MatchmakersMarketplace` |
| Matchmaker CRM dashboard | ✅ Done | `MatchmakerDashboard` |
| Meetings with auto links | ✅ Done | `Meetings` |
| Admin separate layout | ✅ Done | `AdminLayout`, `AdminContent` |
| Admin blog/banner/contact/settings CMS | ✅ Done | `AdminBlogs`, `AdminBanners`, `AdminContacts`, `AdminSettings` |
| Admin actions (ban, deactivate, password reset, message) | ⚠️ Backend done, frontend pending | `AdminUsersTab` needs enhancement |
| `/admin/login` dedicated route | ⚠️ Pending | Add to `App` routing |
| Logout confirmation dialog | ⚠️ Pending | Add to `App.onLogout` |
| Notification + Message badges + sound | ✅ Done | `TopBar`, `BottomNav`, `playChime` |
| Persistent saved filter views | ✅ Done | `SearchView` |
| Auto-seed empty DB | ✅ Done | `server.js` `autoSeedIfEmpty()` |

---

## 🛠️ How to Make Changes (Quick Reference)

### Frontend Change
1. Open `/Users/abdulrehman/Documents/Claude/Projects/My Partner/RishtaConnect/frontend/index.html`
2. Find component by searching `function ComponentName`
3. Edit JSX
4. Compile test: `node -e "..."` with babel
5. `git add . && git commit && git push origin main`
6. Vercel auto-redeploys in 1-2 min

### Backend Change
1. Open `/Users/abdulrehman/Documents/Claude/Projects/My Partner/RishtaConnect/backend/server.js`
2. Add route or modify logic
3. `node -c server.js` to check syntax
4. `git push origin main`
5. Railway auto-redeploys in 2-3 min

### Database Change
- Schema: edit Mongoose schema near top of `server.js`
- Reset: drop collection in MongoDB Atlas UI → restart Railway → auto-seed reruns

### Add a New Page
1. Frontend: add `function NewPage() {...}` component
2. Add route: `{view==="newpage" && <NewPage/>}` in `App`
3. Add nav: button in `MyProfile.ActionTile` or `BottomNav`

### Add a New API Endpoint
1. Backend: `app.get("/api/foo", auth, async (req, res) => { ... })`
2. Frontend: `const data = await api("/api/foo")`

---

## 🔮 Known Pending Items

1. **`/admin/login` separate route** — Currently admin logs in via main login then redirects. User wants dedicated `/#/admin/login` page with different UI.
2. **Logout confirmation modal** — Currently logs out instantly. Need confirm dialog.
3. **AdminUsersTab actions** — Backend endpoints exist (deactivate, reset-password, admin message) but frontend table only has Ban/Unban. Need action menu.
4. **Real-time chat from profile detail** — Profile detail has "Message" button that opens chat; works but needs the chat to actually open a conversation thread with that specific user (currently switches to chat view but conversation may not auto-select).
5. **Email SMTP configuration** — Backend supports it but user needs to add SMTP_HOST/USER/PASS env vars to Railway. Without it, OTPs are logged to console only.

---

## 🐛 Common Issues & Fixes

| Symptom | Fix |
|---------|-----|
| Login says "Invalid credentials" with seeded user | Database not seeded yet — restart Railway to trigger auto-seed |
| Backend shows `"database":"json-file"` | MONGO_URI env var missing in Railway Variables |
| Vercel shows backend JSON instead of website | Vercel Root Directory must be `frontend`, not `backend` |
| "Backend not configured" error on login | API_URL not set; hardcoded fallback should cover this |
| OTP `123456` rejected | OTP is now REAL — check Railway logs for actual code (look for `📧 [OTP for ...]`) |

---

## 📞 User Context

- **User:** Abdul Rehman, GitHub username `Abdul102`
- **Email:** abdul.rehman@iclosed.io
- **Primary Language:** Roman Urdu
- **Stack Preferences:** Free hosting (Vercel + Railway + MongoDB Atlas free tiers)
- **Style:** Wants production-grade, not prototype. Strong emphasis on real data, real auth, no demo placeholders.

---

*Last updated: After session adding real OTP system + admin password reset/deactivate/message endpoints. Pending: frontend `/admin/login` route, logout confirm, AdminUsersTab full action menu.*
