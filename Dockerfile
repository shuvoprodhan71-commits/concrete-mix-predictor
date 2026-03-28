# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install Node dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the frontend (Vite) and backend (esbuild)
RUN pnpm build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Install Python 3 + pip + venv support
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (for production deps)
RUN npm install -g pnpm

# Copy built output from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy ML model files and Python script into both server/ml AND dist/server/ml
# so the path resolver finds them regardless of __dirname location
COPY --from=builder /app/server/ml ./server/ml

# Create Python venv and install ML packages
RUN python3 -m venv server/ml/.venv313 && \
    server/ml/.venv313/bin/pip install --no-cache-dir --upgrade pip && \
    server/ml/.venv313/bin/pip install --no-cache-dir \
    scikit-learn==1.3.2 \
    joblib==1.3.2 \
    numpy==1.26.4 \
    pandas==2.1.4 \
    scipy==1.11.4

# Expose port
EXPOSE 3000

# Start the production server
CMD ["node", "dist/index.js"]
