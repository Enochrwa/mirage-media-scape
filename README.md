# Zovyra Media Player

Zovyra is a high-performance, "addictive" media player designed for the modern web, desktop, and mobile platforms. It leverages **Node.js** for orchestration and **Rust** for native performance.

## 🚀 Vision

To create a media player that feels instantaneous and adapts to the user's mood. By combining a sleek React-based UI with a powerful Rust-powered audio engine, Zovyra provides low-latency playback and advanced audio analysis (BPM detection, Mood indexing) natively.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite.
- **Backend Orchestration:** Node.js (TypeScript), Express, Socket.io.
- **Performance Core:** Rust (FFmpeg bindings, NAPI-RS).
- **UI Components:** Shadcn UI, Lucide Icons.

## 📂 Project Structure

- `src/`: React frontend application.
- `server/`: Node.js backend services.
- `native/`: Rust core for high-performance audio/video processing.
- `docs/`: Technical research and implementation details.

## ⚡ Key Features

- **AI Mood Engine:** Dynamic queue adjustment based on energy levels.
- **Responsive Interface:** Seamless transition between desktop and mobile player views.
- **High Performance:** Native decoding and analysis offloaded to Rust.

## 🛠 Getting Started

### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- FFmpeg (for native modules)

### Installation
1. Clone the repository.
2. Install frontend dependencies: `npm install`
3. Install server dependencies: `cd server && npm install`
4. Build native modules: `cd native && npm install` (if using napi-rs build scripts)

### Running
- Frontend: `npm run dev`
- Backend: `cd server && npm run dev`

### Desktop & Mobile

Zovyra also ships as a native desktop app (Windows/macOS/Linux, via Tauri) and
mobile app (Android/iOS, via Capacitor). See **[NATIVE_SETUP.md](./NATIVE_SETUP.md)**
for dev-mode and production build instructions on all five platforms.
