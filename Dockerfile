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
# Use distro yt-dlp package to avoid TLS/certificate issues during Docker builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    yt-dlp \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY server.js ./
COPY routes/ ./routes/
COPY modules/ ./modules/
COPY models/ ./models/

# Copy built frontend from stage 1
COPY --from=frontend-builder /build/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
