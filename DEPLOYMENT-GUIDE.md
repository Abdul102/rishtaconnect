# 🚀 RishtaConnect — Free Live Deployment Guide (Roman Urdu)

Is guide ko follow karke aap apni website 30-45 minutes mein **internet par bilkul free** publish kar sakte hain.

**Hum 3 free services use karein gay:**

| Service | Kis ke liye | Cost | Time |
|---------|-------------|------|------|
| **MongoDB Atlas** | Database (user data save karne ke liye) | Free 512MB | 10 min |
| **Railway** | Backend (Node.js API) | Free $5/month credit | 10 min |
| **Vercel** | Frontend (website) | Free unlimited | 5 min |

**Total cost: ₨ 0 (zero)** — phir bhi production-grade website.

---

## 📋 Pre-requisites

Sirf 3 cheezein chahiye:
1. ✅ GitHub account (free) — https://github.com/signup
2. ✅ Email address
3. ✅ Computer + internet

Code download/clone karne ki zaroorat nahi — sab kuch online ho sakta hai!

---

## STEP 1: MongoDB Atlas — Free Database Setup (10 min)

### 1.1 Account banayein

1. Browser mein kholein: **https://www.mongodb.com/cloud/atlas/register**
2. "Sign up with Google" ya email se signup karein
3. Welcome screen par "I'm learning MongoDB" select karein

### 1.2 Free Cluster banayein

1. **"Build a Database"** par click karein
2. **M0 FREE** plan select karein (sab se neeche wala)
3. Provider: **AWS** • Region: **Singapore** (Pakistan ke qareeb)
4. Cluster name: `RishtaConnect` likhein
5. **"Create"** par click karein (1-2 min lagain ge)

### 1.3 Database User banayein

1. Left side mein **"Database Access"** par click karein
2. **"Add New Database User"** par click
3. Username: `rishtaadmin`
4. Password: `Mazboot123!` (apna strong password use karein, kahi note kar lein!)
5. **Built-in Role**: "Atlas admin" select karein
6. **"Add User"** par click

### 1.4 Network Access (Important!)

1. Left side mein **"Network Access"** par click
2. **"Add IP Address"** par click
3. **"ALLOW ACCESS FROM ANYWHERE"** button par click karein (`0.0.0.0/0` add ho jayega)
4. **"Confirm"** par click

> ⚠️ Production mein sirf Railway ka IP allow karna chahiye. Abhi simplicity ke liye sab allowed.

### 1.5 Connection String hasil karein

1. Left side mein **"Database"** par click
2. Apne cluster ke saath **"Connect"** button par click
3. **"Drivers"** select karein
4. Driver: **Node.js**, Version: **6.7 or later**
5. Connection string copy karein, kuch is tarah ka hoga:

```
mongodb+srv://rishtaadmin:<password>@rishtaconnect.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. `<password>` ko apne actual password se replace karein (jo aap ne 1.3 mein banaya)
7. `/?retryWrites` se pehle `rishtaconnect` add karein, final string ye banegi:

```
mongodb+srv://rishtaadmin:Mazboot123!@rishtaconnect.xxxxx.mongodb.net/rishtaconnect?retryWrites=true&w=majority
```

8. Is string ko notepad mein save karein — Step 2 mein chahiye hogi.

✅ **MongoDB done!**

---

## STEP 2: GitHub Par Code Upload (5 min)

Code ko GitHub par push karna hai taake Railway aur Vercel use kar sakein.

### 2.1 GitHub Repository banayein

1. https://github.com/new par jayein
2. Repository name: `rishtaconnect`
3. **Public** select karein (free deployment ke liye)
4. **"Create repository"** par click

### 2.2 Code Upload Method

**Option A: GitHub Desktop (easiest)**
1. https://desktop.github.com download karein
2. App install karein, GitHub se login karein
3. "Add an Existing Repository from your Hard Drive" par click
4. RishtaConnect folder select karein (jo aap ke `Documents/Claude/Projects/My Partner/RishtaConnect/` mein hai)
5. "Publish repository" par click

**Option B: Terminal se (agar Git installed hai)**
```bash
cd "/Users/abdulrehman/Documents/Claude/Projects/My Partner/RishtaConnect"
git init
git add .
git commit -m "Initial RishtaConnect commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rishtaconnect.git
git push -u origin main
```

**Option C: Browser se drag-drop**
1. GitHub repo page par "uploading an existing file" link click karein
2. RishtaConnect folder ke andar ki saari files drag karein
3. "Commit changes" par click

✅ **Code GitHub par chala gaya!**

---

## STEP 3: Railway — Backend Deploy (10 min)

### 3.1 Railway account banayein

1. https://railway.app par jayein
2. **"Login with GitHub"** par click
3. GitHub authorize karein

### 3.2 Backend Deploy karein

1. Railway dashboard par **"New Project"** par click
2. **"Deploy from GitHub repo"** select karein
3. Apni `rishtaconnect` repo select karein
4. **"Add variables"** par click karein (Settings → Variables tab)
5. Important: **Root Directory** set karein:
   - Settings → "Root Directory" → `backend` likhein → Save

### 3.3 Environment Variables add karein

Railway project mein **Variables** tab mein 3 variables add karein:

| Variable Name | Value |
|---|---|
| `JWT_SECRET` | `koi-bhi-lamba-random-string-yahan-likhein-min-32-chars` |
| `MONGO_URI` | (Step 1.5 wali connection string) |
| `PORT` | `4000` |

**JWT_SECRET ke liye random string generate karne ka tareeqa:**
- Online: https://randomkeygen.com par "CodeIgniter Encryption Keys" se ek lambi string copy karein
- Ya phir simply: `RishtaConnect-Secret-2026-Pakistan-Lahore-Karachi-Islamabad-2399!@#`

### 3.4 Deploy hone ka intezar karein

- Railway automatically build start kar dega (1-2 min)
- Top right corner mein **"Deployments"** tab mein progress dekh sakte hain
- Jab status **"Active"** ho jaye to backend ready hai!

### 3.5 Public URL hasil karein

1. Project Settings → **"Networking"** par jayein
2. **"Generate Domain"** par click
3. Aap ko URL milay ga: `https://rishtaconnect-production-xxxx.up.railway.app`
4. URL copy karein — Step 4 mein chahiye

### 3.6 Database seed karein (demo data)

Railway mein:
1. Project → **"Settings"** → **"Service"** → **"Start Command"** ko temporarily change karein: `node seed.js && node server.js`
2. Redeploy ho jayega aur demo data add ho jayega
3. Phir wapas `node server.js` kar dein

**Ya simply** Railway ki built-in CLI use karein (advanced) — guide ke baad add ki ja sakti hai.

### 3.7 Test karein

Browser mein open karein: `https://YOUR-RAILWAY-URL.up.railway.app/`

Aap ko ye dikhna chahiye:
```json
{"name":"RishtaConnect API","status":"ok","database":"mongodb-atlas","version":"2.0.0"}
```

✅ **Backend live ho gaya!**

---

## STEP 4: Vercel — Frontend Deploy (5 min)

### 4.1 Frontend ko backend se connect karein

1. GitHub par apni repo open karein
2. `frontend/config.js` file edit karein (pencil icon click karein)
3. Ye change karein:

```javascript
window.API_URL = "https://YOUR-RAILWAY-URL.up.railway.app";
```

(Step 3.5 wali URL paste karein)

4. **"Commit changes"** par click

### 4.2 Vercel par deploy karein

1. https://vercel.com par jayein
2. **"Sign up with GitHub"** par click
3. Dashboard mein **"Add New Project"** par click
4. Apni `rishtaconnect` repo select karein → **"Import"**
5. **Root Directory** par "Edit" click karein → **"frontend"** select karein
6. Framework Preset: **"Other"** rakhein
7. **"Deploy"** par click

1-2 minutes mein deployment complete ho jayega aur aap ko URL milay ga jaise:
```
https://rishtaconnect-xxxx.vercel.app
```

✅ **Website live ho gayi!**

---

## STEP 5: Test karein 🎉

Apni live website kholein: `https://rishtaconnect-xxxx.vercel.app`

**Sab kuch test karein:**

1. ✅ Landing page khulay aur banners chalein
2. ✅ Blog section show ho
3. ✅ Contact form bharein → admin inbox mein aana chahiye
4. ✅ "Create Free Profile" par click karein
5. ✅ Signup karein (OTP: **123456**)
6. ✅ Biodata complete karein
7. ✅ Search aur matches dekhein
8. ✅ Chat try karein
9. ✅ Logout karein

**Admin panel test karein:**

1. Login karein: `admin@rishta.com` / `admin1234`
2. Profile → Admin Panel par jayein
3. Test karein:
   - **Blogs** tab: New blog post likhein, save karein, landing page par dekhein
   - **Banners** tab: Naya banner banayein, color change karein
   - **Messages** tab: Contact form ke messages yahan dikhain ge
   - **Settings** tab: Site name, contact info, social links change karein

---

## 🎨 Customization

### Apna logo aur color change karne ke liye:
1. Admin Panel → **Settings** tab par jayein
2. Site Name, Primary Color, Contact details change karein
3. **"Save Settings"** par click — turant landing page par dikhe ga

### Domain custom kaise lagayein? (optional)
- Vercel project settings → Domains → Apna domain add karein
- DNS records jo Vercel show karega woh apne domain registrar par add karein
- Free SSL automatically lagega

---

## 🔧 Troubleshooting

### "Backend offline" jaisa kuch dikhe?
- Railway dashboard par check karein — service "Active" ho?
- Logs dekhein — koi error hai?
- MongoDB URI sahi hai? Password aur cluster name verify karein.

### Frontend par data nahi aa raha?
- Browser console open karein (F12)
- Network tab mein API calls dekhein — kis URL par ja rahi hain?
- `config.js` mein `API_URL` sahi hai?

### Admin panel mein "Admin only" error?
- Admin user se login hain? `admin@rishta.com` / `admin1234`
- Token expire to nahi ho gaya — logout aur dobara login karein

---

## 📞 Support

Koi bhi step mein masla aaye to:
- Railway logs check karein
- Vercel deployment logs check karein
- MongoDB Atlas par cluster status dekhein

**Aap ka RishtaConnect ab duniya bhar mein internet par live hai!** 🎉🌙

Free hosting limits:
- MongoDB Atlas: 512 MB storage — ~5,000 users tak comfortable
- Railway: $5/month free credit — chhota traffic free
- Vercel: 100 GB bandwidth/month free — unlimited visitors

Jab grow ho jaye, paid plans bhi affordable hain.
