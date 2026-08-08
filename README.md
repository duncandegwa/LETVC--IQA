# Laikipia East TVC — IQA Management System

A step-by-step guide to get this running on your own computer, and then deployed live on
Vercel. Written assuming you're starting from a clean machine — every tool you need is
covered, in order.

**What this system uses:**
- **Firebase Authentication** — handles login, passwords, and password resets
- **Supabase** — hosts the PostgreSQL database
- **Node.js + Express** — the backend API
- **React (Vite)** — the frontend

---

## Part 1 — Install the tools you need (once per computer)

Skip any step where you already have the tool. To check, open a terminal and run the
"Check" command — if it prints a version number, you're set.

### 1.1 Node.js (includes npm)
This runs both the backend and frontend.
- Go to [nodejs.org](https://nodejs.org) and download the **LTS** version for your OS.
  Run the installer, accepting the defaults.
- **Check:**
  ```bash
  node -v
  npm -v
  ```
  You should see something like `v20.x.x` and `10.x.x`. You need Node **18 or higher**.

### 1.2 Git
Used to download this project (if you don't already have the folder) and to push it to
GitHub for Vercel later.
- Windows: [git-scm.com/download/win](https://git-scm.com/download/win), run the
  installer with defaults.
- Mac: open Terminal and run `git --version` — macOS will prompt you to install it if
  missing.
- Linux: `sudo apt install git` (Debian/Ubuntu) or your distro's equivalent.
- **Check:** `git --version`

### 1.3 A code editor
Not strictly required, but you'll want one to edit `.env` files. [VS Code](https://code.visualstudio.com)
is a solid free option if you don't have a preference.

### 1.4 A PostgreSQL client (optional but handy)
You won't install Postgres itself — Supabase hosts that for you — but a free GUI like
[TablePlus](https://tableplus.com) or [Beekeeper Studio](https://www.beekeeperstudio.io)
makes it easy to peek at your data later. Not required to get the system running.

---

## Part 2 — Get the project onto your computer

If you already have the `laikipia-iqa` folder (e.g. you downloaded it from this chat),
unzip it and skip to Part 3. Otherwise, if it's in a Git repository:
```bash
git clone <your-repo-url>
cd laikipia-iqa
```

You should now have this folder structure:
```
laikipia-iqa/
  backend/    <- the API
  frontend/   <- the website
  docs/       <- design notes
```

---

## Part 3 — Create your Firebase project (handles login)

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** and sign
   in with a Google account.
2. Click **Add project**. Name it something like `laikipia-iqa` and click through the
   setup screens (you can disable Google Analytics — not needed here).
3. Once the project opens, in the left sidebar click **Build → Authentication**, then
   click **Get started**.
4. Under **Sign-in method**, click **Email/Password**, toggle it **Enabled**, and click
   **Save**.

### 3.1 Get your web app config (for the frontend)
1. Click the **gear icon** (top left, next to "Project Overview") → **Project settings**.
2. Scroll down to **Your apps**. Click the **`</>`** (web) icon to register a new app.
3. Give it a nickname (e.g. `iqa-web`) and click **Register app**. You don't need
   Firebase Hosting.
4. You'll see a code block with a `firebaseConfig` object. **Keep this tab open** — you'll
   copy six values from it into `frontend/.env` in Part 5.

### 3.2 Get your service account key (for the backend)
1. Still in **Project settings**, click the **Service accounts** tab.
2. Click **Generate new private key**, then confirm. A `.json` file downloads to your
   computer.
3. **Keep this file safe and never commit it to Git** — it grants full admin access to
   your Firebase project. You'll copy three values out of it into `backend/.env` in
   Part 5.

---

## Part 4 — Create your Supabase project (hosts the database)

1. Go to **[supabase.com](https://supabase.com)** and sign in (GitHub login is easiest).
2. Click **New project**. Pick an organization (create one if it's your first time),
   name the project `laikipia-iqa`, and set a **database password** — click **Generate a
   password** and **save it somewhere** (a password manager, or a note for now — you'll
   need it in a moment). Choose a region close to you. Click **Create new project** and
   wait about a minute for it to provision.
3. Once it's ready, go to **Project Settings** (gear icon) → **Database**.
4. Under **Connection string**, you'll see a few tabs/formats. You need two different
   versions of this string during this guide:
   - **Direct connection** (usually shown with port `5432`) — use this for local
     development and for running database migrations.
   - **Transaction pooler** (usually shown with port `6543` and `?pgbouncer=true` in the
     URL) — you'll only need this later, if you deploy the backend to Vercel (Part 8).
5. Copy the **direct connection** string now. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with the database password from step 2. Keep this handy for
   Part 5.

### 4.1 Create a Storage bucket (required — this is where uploaded PDFs actually live)
1. In your Supabase project, go to **Storage** in the left sidebar → **New bucket**.
2. Name it `documents` and leave it **Private** (not public) — the app serves files
   through its own login-protected routes, not a public bucket URL.
3. Go to **Project Settings → API**. Copy two values, you'll need them in Part 5:
   - **Project URL**
   - The **`service_role`** secret key (further down the page, under "Project API keys" —
     **not** the `anon` public key; the service role key is what lets the backend write
     to a private bucket).

---

## Part 5 — Configure the backend

```bash
cd backend
cp .env.example .env
```
Open `backend/.env` in your code editor and fill in each value:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | The **direct** Supabase connection string from Part 4 step 5 |
| `FIREBASE_PROJECT_ID` | Open the service account `.json` file from Part 3.2 — copy the `project_id` value |
| `FIREBASE_CLIENT_EMAIL` | Same file — copy the `client_email` value |
| `FIREBASE_PRIVATE_KEY` | Same file — copy the entire `private_key` value, **including** the quotes and the `\n` characters exactly as they appear. Paste it as one line, wrapped in double quotes. |
| `SUPABASE_URL` | The **Project URL** from Part 4.1 step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | The **`service_role`** key from Part 4.1 step 3 |
| `SUPABASE_STORAGE_BUCKET` | Leave as `documents` unless you named your bucket something else |
| `CLIENT_URL` | Leave as `http://localhost:5173` for now |
| `SMTP_*` | Leave blank for now — the system will just print notification emails to the terminal instead of sending them. Not needed to get things running. |

Your `FIREBASE_PRIVATE_KEY` line in `.env` should end up looking like this (shortened
here for readability):
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...restofkey...\n-----END PRIVATE KEY-----\n"
```

### Install and set up the database
```bash
npm install
```
This downloads all the backend's dependencies (Express, Prisma, the Firebase Admin SDK,
etc.) into a `node_modules` folder — it can take a minute or two the first time.

```bash
npx prisma migrate dev --name init
```
This connects to your Supabase database using `DATABASE_URL` and creates every table the
system needs (users, departments, documents, reviews, and so on). If this fails, double
check `DATABASE_URL` — a copy-paste mistake in the password is the most common cause.

```bash
npm run seed
```
This creates a starter Administrator account (and a few demo Trainer/HOD/IQA accounts)
in **both** Firebase Auth and your Supabase database, so you have something to log in
with immediately. Watch the terminal output — it prints the login email and password.

### Start the backend
```bash
npm run dev
```
Leave this running. You should see something like:
```
Laikipia IQA backend listening on :4000
```
Open `http://localhost:4000/api/health` in your browser — you should see
`{"ok":true,"service":"laikipia-iqa-backend"}`. If you see that, the backend is alive and
correctly talking to Supabase.

---

## Part 6 — Configure the frontend

Open a **new** terminal window/tab (leave the backend running in the first one):
```bash
cd frontend
cp .env.example .env
```
Open `frontend/.env` and fill in the six values from the `firebaseConfig` object you kept
open in Part 3.1:

| `.env` variable | `firebaseConfig` field |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

### Install and start
```bash
npm install
npm run dev
```
You should see:
```
Local:   http://localhost:5173/
```

### How the frontend and backend link up locally
You don't need to configure this — it's already wired for you. Open
`frontend/vite.config.js` and you'll see:
```js
server: {
  port: 5173,
  proxy: { '/api': 'http://localhost:4000' },
},
```
This means: whenever the React app calls `/api/...`, Vite quietly forwards that request
to your backend at `http://localhost:4000`. That's the entire link between frontend and
backend in local development — as long as both `npm run dev` processes are running side
by side, they can talk to each other.

---

## Part 7 — Log in and try it out

1. Open `http://localhost:5173` in your browser.
2. Sign in with the Administrator email/password printed by `npm run seed` in Part 5
   (default seed uses `admin@laikipiaeasttvc.ac.ke` / `ChangeMe123!` unless you edited
   `backend/prisma/seed.js`).
3. From the Admin dashboard, try creating a new Trainer, department, or reviewer
   assignment — each action you take here is really doing two things at once: creating a
   login in Firebase, and creating a matching profile row in your Supabase database.
4. To see the conflict-of-interest rule in action: the seed script creates a "John" who
   is both an ICT Trainer and ICT HOD. Log in as John, upload a document, then check that
   it never lands in John's own HOD review queue — it should route to the alternate HOD
   instead.

If login fails with a Firebase error, double-check Part 3 (Email/Password provider
enabled?) and that `frontend/.env` values are typed correctly, then restart
`npm run dev` in the frontend terminal (Vite only reads `.env` at startup).

---

## Part 8 — Deploy to Vercel

You'll create **two separate Vercel projects** from the same repository — one for
`backend/`, one for `frontend/` — plus keep using the same Supabase database from Part 4.

### 8.1 Push your project to GitHub
Vercel deploys by connecting to a Git repository, not by uploading a folder.
```bash
cd laikipia-iqa
git init
git add .
git commit -m "Initial commit"
```
Create a new empty repository on [github.com/new](https://github.com/new), then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```
Your `.env` files are already excluded from Git by `.gitignore` — never commit them,
since they contain secrets.

### 8.2 Create a Vercel account
Go to [vercel.com](https://vercel.com) and sign up (GitHub sign-in is easiest, since it
also connects your repos automatically).

### 8.3 Deploy the backend
1. On the Vercel dashboard, click **Add New → Project**.
2. Import the GitHub repo you just pushed.
3. Vercel will ask for a **Root Directory** — click **Edit** and set it to `backend`.
4. Before clicking Deploy, expand **Environment Variables** and add each of these (same
   values as your local `backend/.env`, with one change noted below):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Supabase **pooled** connection string this time (port `6543`, with `?pgbouncer=true`) — go back to Supabase → Project Settings → Database → Connection string and copy the pooler version. This matters: Vercel runs your backend as many short-lived functions, and the direct connection string will run out of allowed connections under real use. |
   | `FIREBASE_PROJECT_ID` | Same as local |
   | `FIREBASE_CLIENT_EMAIL` | Same as local |
   | `FIREBASE_PRIVATE_KEY` | Same as local — if Vercel's input field mangles the multi-line value, use `FIREBASE_SERVICE_ACCOUNT_JSON` instead: paste the *entire* downloaded service-account `.json` file's contents as one single-line value |
   | `SUPABASE_URL` | Same as local (Part 4.1) — **required** on Vercel, not optional here. Without this, uploaded files use Vercel's temporary `/tmp` storage and will unpredictably disappear between requests. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same as local (Part 4.1) — required for the same reason |
   | `SUPABASE_STORAGE_BUCKET` | Same as local, usually `documents` |
   | `CLIENT_URL` | Leave blank for now — you'll set this in step 8.5 once the frontend has a URL |
   | `SMTP_*` | Same as local, if you have them |

5. Click **Deploy**. After a minute you'll get a URL like
   `https://your-backend-project.vercel.app`. **Copy this URL** — you need it next.

### 8.4 Run the database migration against production
Your Supabase database already has tables from Part 5, so if you're using the *same*
Supabase project for production, you can skip this. If you created a **separate**
Supabase project for production, run this once from your own computer:
```bash
cd backend
DATABASE_URL="<supabase DIRECT connection string>" npx prisma migrate deploy
DATABASE_URL="<supabase DIRECT connection string>" npm run seed
```
(Use the direct connection string here, not the pooled one — this is a one-off command
from your machine, not the always-on deployed app.)

### 8.5 Deploy the frontend
1. Back on Vercel, **Add New → Project** again, same GitHub repo.
2. Set **Root Directory** to `frontend`. Vercel auto-detects it's a Vite app.
3. Add the same six `VITE_FIREBASE_*` Environment Variables from Part 6.
4. **Before deploying**, open `frontend/vercel.json` in your code editor and replace the
   placeholder with the backend URL you copied in step 8.3:
   ```json
   {
     "version": 2,
     "rewrites": [
       { "source": "/api/(.*)", "destination": "https://your-backend-project.vercel.app/api/$1" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   This is the production equivalent of the `vite.config.js` proxy from Part 6 — it makes
   `/api/*` requests from the deployed frontend transparently reach your deployed
   backend, without any cross-origin/cookie complications.
5. Commit and push that change:
   ```bash
   git add frontend/vercel.json
   git commit -m "Point frontend proxy at deployed backend"
   git push
   ```
6. Click **Deploy** on Vercel (or let it auto-deploy from the push, if you connected the
   repo before editing the file). You'll get a frontend URL like
   `https://your-frontend-project.vercel.app`.

### 8.6 Connect the two: update CLIENT_URL
Go back to your **backend** project on Vercel → **Settings → Environment Variables**,
edit `CLIENT_URL` to your frontend's URL from step 8.5, and redeploy the backend
(**Deployments → ⋯ → Redeploy**).

### 8.7 Authorize your domain in Firebase
This step is easy to miss and will cause sign-in to silently fail if skipped:
1. Firebase Console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain** and enter your frontend's Vercel domain, e.g.
   `your-frontend-project.vercel.app`.

### 8.8 Verify the live deployment
1. Visit `https://your-frontend-project.vercel.app`.
2. Confirm `https://your-frontend-project.vercel.app/api/health` (via the proxy) returns
   `{"ok": true, ...}`.
3. Log in with your Administrator account and confirm you can reach the dashboard.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Backend won't start / Prisma errors | `DATABASE_URL` typo, or you forgot `npx prisma migrate dev` |
| "Invalid or expired session" on every request | Frontend and backend are pointed at **different** Firebase projects — double check `VITE_FIREBASE_PROJECT_ID` matches `FIREBASE_PROJECT_ID` |
| Login works locally but not on Vercel | You skipped Part 8.7 (Firebase authorized domains) |
| Uploads disappear / `ENOENT` errors trying to preview or download a file you just uploaded, on Vercel | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` aren't set in your backend's Vercel environment variables (Part 8.3) — without them, the backend silently falls back to Vercel's ephemeral `/tmp`, which isn't shared between requests. Add both, create the Storage bucket from Part 4.1 if you haven't, and redeploy. Check the function logs for a `[storage] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set` warning to confirm this is the cause. |
| "Too many connections" errors under load on Vercel | You used the **direct** Supabase connection string instead of the **pooled** one in the backend's Vercel environment variables (Part 8.3) |
| `PrismaClientUnknownRequestError: prepared statement "sN" already exists` in the function logs | Your Supabase pooled `DATABASE_URL` is missing `?pgbouncer=true`. Fixed automatically as of this version — the backend now detects a pooler connection string and adds it if missing — but if you're still on older code, add `?pgbouncer=true&connection_limit=1` to the end of the pooled `DATABASE_URL` in your Vercel backend env vars and redeploy. |
| `The table 'public.TrainerReviewerAssignment' does not exist` (or `Message`, or any similar "table does not exist" error after pulling an update) | You already had the project set up and an update added a new database table. Run `npx prisma migrate dev` again from `backend/` — Prisma only applies the *new* migration, it won't touch your existing data |

---

## What's fully built vs. stubbed

See `docs/ARCHITECTURE.md` §9 for the full breakdown. In short: Firebase auth, RBAC,
document upload/versioning, and the full conflict-of-interest reviewer-assignment and
workflow-state-machine engine are complete. PDF stamping, notification email, bulk
import, and report exports have real integration points wired up but use placeholder
logic — finish those against your actual PDF template and SMTP provider before relying
on them in production.
