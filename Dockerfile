# One image, everything included: ffmpeg (with libx265), dovi_tool, node.
FROM node:20-slim

# ffmpeg from apt (Debian's build includes libx265)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Rust + dovi_tool (compiled once, at image build time — not on every deploy)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install dovi_tool

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server-transcode.js .

EXPOSE 3001
CMD ["node", "server-transcode.js"]
