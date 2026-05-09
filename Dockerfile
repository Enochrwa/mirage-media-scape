FROM node:26-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ pkg-config libc6-dev libavcodec-dev libavformat-dev libavutil-dev libswresample-dev libswscale-dev libavdevice-dev libavfilter-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN cd frontend && npm install && npm run build
RUN cd server && npm install && npm run build
FROM node:26-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/server /app/server
COPY --from=builder /app/frontend/dist /app/frontend/dist
COPY --from=builder /app/package.json /app/package.json
EXPOSE 3001
CMD ["npm", "start", "--prefix", "server"]
