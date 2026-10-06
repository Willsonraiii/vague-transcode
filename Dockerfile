# Universal production Dockerfile for Obito Studio (Hugging Face Spaces, Koyeb, Render, VPS)
FROM node:20-slim

# Install system dependencies (ffmpeg and ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create required writable directories for jobs and uploads
RUN mkdir -p /app/jobs /app/uploads && chmod -R 777 /app/jobs /app/uploads

# Install server backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy backend engine, libraries, and built frontend
COPY lib ./lib
COPY tools ./tools
COPY public ./public
COPY server-rtx-online.js ./

# Default port 7860 for Hugging Face Spaces (dynamically overridden by $PORT on other platforms)
ENV PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server-rtx-online.js"]
