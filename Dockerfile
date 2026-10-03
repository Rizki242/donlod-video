FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    BIN_DIR=/data/bin \
    MODELS_DIR=/data/models \
    SHARES_DIR=/data/shares
# Mount volume persisten di /data agar yt-dlp, model Whisper (~450 MB), dan share tidak hilang saat redeploy
VOLUME /data
EXPOSE 3000
CMD ["node", "build/server.js"]
