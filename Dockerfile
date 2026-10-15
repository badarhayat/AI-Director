# ==============================================================================
# Multi-stage Dockerfile for AI-MIMS (Punjab Mining Inspection & Monitoring System)
# Stage 1: Build React/Vite/TypeScript frontend
# Stage 2: Python 3.11 runtime with geospatial and computer vision dependencies
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build
# ------------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy dependency manifests
COPY frontend/package.json frontend/package-lock.json ./

# Clean installation of dependencies
RUN npm ci

# Copy frontend source and configuration
COPY frontend/ ./

# Build production bundle to /app/frontend/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Backend & Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

# Prevent Python from writing .pyc files and enable unbuffered streaming logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    HOST=0.0.0.0 \
    PORT=10000

# Install required system libraries for OpenCV, image processing, and geospatial packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend requirements and install dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled frontend from frontend-builder stage into the exact path expected by FastAPI
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure application storage directories exist
RUN mkdir -p /app/backend/app/data/reports \
             /app/backend/app/data/sample_imagery \
             /app/backend/app/data/uploads

WORKDIR /app/backend

# Render listens on the dynamic PORT environment variable (default 10000)
EXPOSE 10000

# Start Uvicorn via the backend entrypoint
CMD ["python", "run.py"]
