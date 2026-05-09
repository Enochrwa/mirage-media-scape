# Sonic Media Player

Sonic is a high-performance, "addictive" media player designed for the modern web, desktop, and mobile platforms. It leverages **Node.js** for orchestration and **Rust** for native performance.

## 🚀 Vision

To create a media player that feels instantaneous and adapts to the user's mood. By combining a sleek React-based UI with a powerful Rust-powered audio engine, Sonic provides low-latency playback and advanced audio analysis (BPM detection, Mood indexing) natively.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Zustand, Tailwind CSS, Vite.
- **Backend Orchestration:** Node.js (TypeScript), Express, Socket.io.
- **Performance Core:** Rust (FFmpeg bindings, NAPI-RS).
- **UI Components:** Shadcn UI, Lucide Icons.

## 📂 Project Structure

- `frontend/`: React frontend application.
- `server/`: Node.js backend services.
- `native/`: Rust core for high-performance audio/video processing.
- `docs/`: Technical research and implementation details.

## ⚡ Key Features

- **AI Mood Engine:** Dynamic queue adjustment based on energy levels.
- **Responsive Interface:** Seamless transition between desktop and mobile player views.
- **High Performance:** Native decoding and analysis offloaded to Rust.
- **Strictly Typed:** Full TypeScript safety across the application.

## 🛠 Getting Started

### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- FFmpeg (for native modules)

### Installation
1. Clone the repository.
2. Install all dependencies from root:
   ```bash
   npm run install:all
   ```

### Development
- Run both Frontend and Backend concurrently from root:
  ```bash
  npm run dev
  ```

- Run individually:
  - Frontend: `npm run dev:frontend`
  - Backend: `npm run dev:server`

### Docker
You can also run the entire platform using Docker:
```bash
docker-compose up --build
```
