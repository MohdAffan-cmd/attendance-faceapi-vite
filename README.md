# Radiant Clinic Attendance System

A real-time face recognition attendance system built for Radiant Clinic. Staff attendance is marked automatically using webcam-based face detection — no manual sign-ins needed.

---

## Features

- Real-time face detection and recognition via webcam
- Automatic attendance marking with timestamp
- Attendance history log
- Export attendance records to Excel (`.xlsx`)
- Face capture and storage on registration
- Demo mode when backend is unavailable

---

## Tech Stack

- **Frontend** — React 18, Vite 5
- **Face Recognition** — face-api.js (runs in browser)
- **Backend** — Node.js, Express
- **Storage** — JSON, Excel (local dev)

---

## Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

### Running the app

Start the backend:
```bash
cd backend
npm install
npm run start
```

Start the frontend:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Requirements

The `public/models/` directory must contain the face-api.js model files for face recognition to work.

---

## Deploy (frontend only) to Vercel

This repo is set up so Vercel only installs **frontend** dependencies. The backend lives in `backend/` and is not part of the Vercel build.

Vercel settings:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`