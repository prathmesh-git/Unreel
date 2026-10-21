# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /build
COPY client/package*.json ./client/
RUN npm install --prefix client

COPY client/ ./client/
RUN npm run build --prefix client


# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-slim

# Install runtime dependencies.
# python3-certifi + python3-brotli are needed for yt-dlp's --impersonate flag
# (TLS fingerprint impersonation for Instagram/TikTok downloads)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    python3-certifi \
    python3-brotli \
    && update-ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY server.js ./
COPY routes/ ./routes/
COPY middleware/ ./middleware/
COPY modules/ ./modules/
COPY models/ ./models/

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
