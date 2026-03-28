# Unreel 🎬

> AI-powered fact-checker for viral videos — detects bias, verifies claims, and exposes misinformation in YouTube Shorts, Instagram Reels, TikTok videos, and pasted transcripts.

---

## What It Does

Paste a short-form video link, upload a file, or paste a transcript and Unreel will:

1. **Download & transcribe** the video audio using Groq Whisper
2. **Extract on-screen text** via OCR from key video frames
3. **Identify factual claims** using LLaMA 3 via Groq
4. **Fact-check each claim** against live web sources via Tavily Search
5. **Measure bias** on a 0–100 scale with type detection and indicators
6. **Persist results** to MongoDB so you can retrieve past analyses anytime

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, Vite, React Router, Lucide Icons      |
| Backend   | Node.js, Express                                |
| Auth      | JWT, Google OAuth, bcryptjs                     |
| Database  | MongoDB, Mongoose                               |
| AI/ML     | Groq Whisper (STT), Groq LLaMA 3.1 (LLM), Tavily (search) |
| Video     | yt-dlp (download), ffmpeg (keyframe extraction) |

---

## Project Structure

```
unreel/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Navbar, Hero, HowItWorks, Features, Footer,
│   │   │                    # ResultsOverlay, ResultsPage
│   │   ├── context/         # AuthContext (JWT + Google OAuth)
│   │   ├── pages/           # AnalyzePage, HistoryPage, LoginPage, RegisterPage
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── middleware/               # Auth middleware (JWT verification)
│   └── authMiddleware.js
├── models/                   # Mongoose schemas
│   ├── AnalysisResult.js
│   └── User.js
├── modules/                  # Backend service modules
│   ├── audioExtractor.js     # ffmpeg keyframe extraction
│   ├── biasAnalyzer.js       # Bias scoring via Groq LLaMA
│   ├── claimExtractor.js     # Claim extraction via Groq LLaMA
│   ├── downloader.js         # yt-dlp video downloader
│   ├── factChecker.js        # Fact-checking via Tavily + Groq
│   ├── ocrExtractor.js       # On-screen text extraction
│   └── transcriber.js        # Audio transcription via Groq Whisper
├── routes/                   # Express route handlers
│   ├── analyze.js            # POST /api/analyze/url, /upload, /text
│   ├── auth.js               # POST /api/auth/register, /login, /google
│   ├── history.js            # GET / DELETE /api/history
│   └── results.js            # GET  /api/results, /api/results/:id
├── .env.example
├── Dockerfile
├── render.yaml
├── package.json
└── server.js                 # App entry point
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) — add to PATH
- ffmpeg — add to PATH

### 1. Clone & Install

```bash
git clone https://github.com/your-username/unreel.git
cd unreel
npm install
npm install --prefix client
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
GROQ_API_KEY=your_groq_api_key          # Whisper transcription + LLaMA 3.1 (free)
TAVILY_API_KEY=your_tavily_api_key      # Web search (free tier available)
MONGODB_URI=mongodb://127.0.0.1:27017/unreel
JWT_SECRET=replace_with_a_strong_secret
PORT=3000
VITE_API_BASE_URL=                    # optional, set when frontend and backend are on different domains
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email_username
SMTP_PASS=your_email_password_or_app_password
SMTP_FROM="Unreel" <no-reply@unreeled.in>
MAIL_BRAND_NAME=Unreel
MAIL_BRAND_COLOR=#7c3aed
MAIL_LOGO_URL=https://www.unreeled.in/og-image.png
```

If SMTP variables are set, Unreel sends a standard welcome email to newly created accounts (email signup and first-time Google signup).
Use `MAIL_BRAND_*` values to customize the email branding without touching code.

### 3. Development Mode

```bash
npm run dev
```

This runs both the backend (nodemon) and frontend (Vite) concurrently with hot reload. The Vite dev server proxies API requests to Express on port 3000.

### 4. Production Build

```bash
npm run build      # Builds the React frontend
npm start          # Starts the Express server serving the built frontend
```

Open [http://localhost:3000](http://localhost:3000)

---

## Frontend Routes

| Route           | Page                  |
|-----------------|-----------------------|
| `/`             | Dashboard (input form, How It Works, Features) |
| `/analyze`      | Analysis loading page (redirected on submit) |
| `/results/:id`  | Full analysis results |
| `/history`      | Past analyses (authenticated users) |
| `/login`        | Login page            |
| `/register`     | Register page         |

---

## API Reference

| Method | Endpoint               | Auth     | Description                        |
|--------|------------------------|----------|------------------------------------|
| POST   | `/api/analyze/url`     | Optional | Analyze video from URL             |
| POST   | `/api/analyze/upload`  | Optional | Analyze uploaded video file        |
| POST   | `/api/analyze/text`    | Optional | Analyze pasted transcript text     |
| GET    | `/api/results`         | —        | Fetch recent analyses              |
| GET    | `/api/results/:id`     | —        | Fetch a single analysis by ID      |
| GET    | `/api/history`         | Required | Fetch user's past analyses         |
| DELETE | `/api/history/:id`     | Required | Delete one history item            |
| DELETE | `/api/history`         | Required | Clear all history items            |
| POST   | `/api/auth/register`   | —        | Register with email/password       |
| POST   | `/api/auth/login`      | —        | Login with email/password          |
| POST   | `/api/auth/google`     | —        | Login/register via Google OAuth    |
| GET    | `/api/health`          | —        | Server & MongoDB health check      |

---

## Free API Keys

| Service | Free Tier | Link |
|---------|-----------|------|
| Groq (Whisper + LLaMA 3.1) | Generous free tier | https://console.groq.com |
| Tavily Search | 1,000 searches/month | https://tavily.com |

---

## Deploying to Render

Render is the recommended host — it runs a full Docker container so yt-dlp, ffmpeg, and long-running analysis all work correctly.

### 1. Push to GitHub

```bash
git add .
git commit -m "deploy: ready for Render"
git push origin main
```

### 2. Create a MongoDB Atlas database (free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free cluster
2. Create a database user and whitelist **0.0.0.0/0** in Network Access
3. Copy your connection string:
	`mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/unreel`

### 3. Deploy on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Render will auto-detect the `render.yaml` — confirm settings:
	- **Runtime:** Docker
	- **Plan:** Free
4. Add environment variables under **Environment**:

	| Key | Value |
	|-----|-------|
	| `GROQ_API_KEY` | your key |
	| `TAVILY_API_KEY` | your key |
	| `MONGODB_URI` | your Atlas connection string |
	| `JWT_SECRET` | a strong random secret |

5. Click **Deploy** — first build takes ~5 minutes

> **Note:** The free tier spins down after 15 minutes of inactivity. Upgrade to the Starter plan to keep it always-on.

---

## License

MIT
