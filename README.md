# Radiant Clinic Attendance (Face Recognition)

A React + Vite attendance UI using `face-api.js` (browser) with an optional local Node/Express backend for saving attendance.

## Tech stack

- **Frontend**: React 18, Vite 5, `face-api.js`, `lucide-react`
- **Backend (local/dev)**: Node.js (JavaScript) + Express (`server.cjs`)
- **Local storage (dev)**: `attendance.json`, `attendance.xlsx`, `Picture/` (captures)

## Run locally (frontend + backend)

Open **two terminals** in the project folder.

### Terminal 1: backend API

```bash
npm install
npm run server
```

Backend runs on `http://localhost:5000`.

### Terminal 2: frontend

```bash
npm run dev
```

Frontend runs on the URL printed by Vite (usually `http://localhost:5173`).

## Notes about models

Face models are loaded from **`/models`**, so the repo must include:

- `public/models/*`

## Deploy frontend-only to Vercel

This deploys only the UI. The backend routes (`/api/attendance`) won’t exist on Vercel, so the app will automatically show **demo data** instead of crashing.

1. Push this repo to GitHub.
2. In Vercel: **New Project → Import** the repo.
3. Set:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Deploy.

## GitHub repo naming (suggestions)

- `radiant-clinic-attendance`
- `face-attendance-react`
- `attendance-faceapi-vite`
- `radiant-attendance-face-recognition`

## Push to GitHub (example)

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

