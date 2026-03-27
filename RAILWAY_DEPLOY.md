# Deploying to Railway — Step-by-Step Guide

This guide walks you through deploying the **Concrete Mix Design Predictor** on Railway from scratch.

---

## Prerequisites

- A [Railway account](https://railway.app) (free tier works)
- [Git](https://git-scm.com/downloads) installed on your computer
- A [GitHub account](https://github.com) (Railway deploys from GitHub)

---

## Step 1 — Push Code to GitHub

1. Extract the project ZIP you downloaded
2. Open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
```

3. Create a new repository on [github.com/new](https://github.com/new) (set it to **Private**)
4. Push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Create a Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Authorize Railway to access your GitHub account
5. Select the repository you just created
6. Railway will detect the `Dockerfile` automatically and start building

---

## Step 3 — Add a MySQL Database

1. In your Railway project dashboard, click **+ New**
2. Select **Database** → **MySQL**
3. Wait for the database to provision (about 30 seconds)
4. Click the MySQL service → **Variables** tab
5. Copy the value of `DATABASE_URL` (you will need it in Step 4)

---

## Step 4 — Set Environment Variables

1. Click on your **app service** (not the MySQL service)
2. Go to the **Variables** tab
3. Add the following variables one by one:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Paste the value copied from Step 3 |
| `JWT_SECRET` | Generate with: `openssl rand -hex 64` (or any 64+ char random string) |

> All other variables (`VITE_APP_ID`, `OAUTH_SERVER_URL`, etc.) are Manus-specific and are **not needed** on Railway. Leave them blank or skip them.

---

## Step 5 — Run Database Migration

After the first successful deploy:

1. Click your app service → **Shell** tab (or use Railway CLI)
2. Run:

```bash
pnpm drizzle-kit migrate
```

This creates the `users` table in your MySQL database.

---

## Step 6 — Access Your App

1. Click your app service → **Settings** tab
2. Under **Domains**, click **Generate Domain**
3. Railway will give you a public URL like `your-app.up.railway.app`
4. Open it in your browser — the Concrete Mix Design Predictor is live!

---

## Important Notes

| Topic | Detail |
|---|---|
| **First prediction delay** | The first prediction after a cold start takes ~30–60 seconds because the ML models (~115 MB) are downloaded from CDN. Subsequent predictions are fast. |
| **Free tier sleep** | Railway free tier apps sleep after 30 minutes of inactivity. The first request after sleep takes a few seconds to wake up. |
| **No login required** | The prediction tool works without login. The user auth system (login/logout) is present but uses Manus OAuth which is inactive on Railway — it can be safely ignored. |
| **Redeploy on push** | Every `git push` to your `main` branch automatically triggers a new Railway deployment. |

---

## Troubleshooting

**Build fails with "pnpm: command not found"**
→ The Dockerfile installs pnpm automatically. Make sure you are using the provided `Dockerfile`.

**Prediction fails on first try**
→ Wait 60 seconds and try again. The ML models are being downloaded from CDN on first use.

**Database connection error**
→ Make sure `DATABASE_URL` is set correctly in Railway Variables and the MySQL plugin is running.

**Port error**
→ Do not set `PORT` manually. Railway injects it automatically.
