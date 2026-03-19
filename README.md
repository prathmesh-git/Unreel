# Unreel 🎬

> AI-powered fact-checker for viral videos — detects bias, verifies claims, and exposes misinformation in YouTube Shorts, Instagram Reels, and TikTok videos.

---

## What It Does

Paste any short-form video link (or upload a file) and Unreel will:

1. **Download & transcribe** the video audio using OpenAI Whisper
2. **Extract on-screen text** via OCR from key video frames
3. **Identify factual claims** using an LLM (LLaMA 3 via Groq)
4. **Fact-check each claim** against live web sources via Tavily Search
5. **Measure bias** on a 0–100 scale with type detection and indicators
6. **Persist results** to MongoDB so you can retrieve past analyses anytime

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, Vite, Lucide Icons                    |
| Backend   | Node.js, Express                                |
| Database  | MongoDB, Mongoose                               |
| AI/ML     | OpenAI Whisper (STT), Groq LLaMA 3 (LLM), Tavily (search) |
| Video     | yt-dlp (download), ffmpeg (keyframe extraction) |

---

## Project Structure

```
unreel/
├── client/               # React frontend (Vite)
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/   # Navbar, Hero, HowItWorks, Features, Footer, ResultsOverlay
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── models/               # Mongoose schema — AnalysisResult
├── modules/              # Backend service modules
│   ├── audioExtractor.js
│   ├── biasAnalyzer.js
│   ├── claimExtractor.js
│   ├── downloader.js
│   ├── factChecker.js
│   ├── ocrExtractor.js
│   └── transcriber.js
├── routes/               # Express route handlers
│   ├── analyze.js        # POST /api/analyze/url  &  /api/analyze/upload
│   └── results.js        # GET  /api/results      &  /api/results/:id
├── public/               # Vite build output (auto-generated, gitignored)
├── .env.example
├── package.json
└── server.js             # App entry point
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
OPENAI_API_KEY=your_openai_api_key      # Whisper transcription
GROQ_API_KEY=your_groq_api_key          # LLaMA 3 (free tier available)
TAVILY_API_KEY=your_tavily_api_key      # Web search (free tier available)
MONGODB_URI=mongodb://127.0.0.1:27017/unreel
PORT=3000
```

### 3. Build the Frontend

```bash
npm run build
```

### 4. Start the Server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Development Mode (hot reload)

```bash
# Terminal 1 — backend
npm run dev

# Terminal 2 — frontend
npm run dev --prefix client
```

---

## API Reference

| Method | Endpoint               | Description                        |
|--------|------------------------|------------------------------------|
| POST   | `/api/analyze/url`     | Analyze video from URL             |
| POST   | `/api/analyze/upload`  | Analyze uploaded video file        |
| GET    | `/api/results`         | Fetch recent analyses (`?limit=20`)|
| GET    | `/api/results/:id`     | Fetch a single analysis by ID      |
| GET    | `/api/health`          | Server & MongoDB health check      |

---

## Free API Keys

| Service | Free Tier | Link |
|---------|-----------|------|
| Groq (LLaMA 3) | Generous free tier | https://console.groq.com |
| Tavily Search | 1,000 searches/month | https://tavily.com |
| OpenAI Whisper | ~$0.006 / min audio | https://platform.openai.com |

---

## Deploying to Railway

Railway is recommended for this project because it supports Docker deployments, which this app needs for yt-dlp, ffmpeg, and long-running analysis jobs.

### 1. Push to GitHub

```bash
git add .
git commit -m "feat: add Railway deployment config"
git push origin main
```

### 2. Create a MongoDB Atlas database (free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free cluster
2. Create a database user and whitelist **0.0.0.0/0** (allow all IPs) in Network Access
3. Copy your connection string — it looks like:
	`mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/unreel`

### 3. Deploy on Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Choose **Deploy from GitHub repo** and select this repository
3. Railway will detect the `Dockerfile` (or `railway.json`) and build automatically
4. In your Railway service, add these environment variables:

	| Key | Value |
	|-----|-------|
	| `OPENAI_API_KEY` | your key |
	| `GROQ_API_KEY` | your key |
	| `TAVILY_API_KEY` | your key |
	| `MONGODB_URI` | your Atlas connection string |

5. Click **Deploy** — first build takes ~5 minutes (installs ffmpeg + yt-dlp)

Your app will be live on your Railway-generated domain (you can also attach a custom domain).

### 4. Optional: set SITE_URL

After your Railway domain is ready, set:

```env
SITE_URL=https://your-app-name.up.railway.app
```

This keeps sitemap and robots URLs correct in production.

---

## License

MIT
