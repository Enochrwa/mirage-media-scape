# Zovyra — Setup & Usage Guide

A full-stack media player: React frontend, Node.js/Express server, and a Rust native addon
that handles FFmpeg audio analysis.

---

## Prerequisites

| Tool | Version | Required for | Install |
|------|---------|--------------|---------|
| Node.js | ≥ 18 | Everything | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | Everything | Comes with Node |
| Rust + Cargo | stable | Native audio addon | [rustup.rs](https://rustup.rs) |
| FFmpeg | any | Audio decoding (linked by Rust) | [ffmpeg.org](https://ffmpeg.org/download.html) |

> **Rust is only needed once per machine.** After the `.node` binary is compiled it
> persists — teammates pulling the same binary from git or a release artifact never
> need Rust installed.

---

## Project layout

```
zovyra/
├── frontend/          React + Vite app  (port 8080)
├── server/            Express API       (port 3001)
├── native/            Rust NAPI-RS addon
│   ├── src/lib.rs
│   ├── Cargo.toml
│   └── *.node         ← compiled binary (git-committed or CI artifact)
├── scripts/
│   └── check-native.js  ← auto-build hook
└── package.json       ← root workspace scripts
```

---

## First-time setup

### 1. Install all dependencies

```bash
npm run install:all
```

This runs `npm install` in the root, `native/`, `frontend/`, and `server/` in one shot.

At the end of the root install, `postinstall` fires `scripts/check-native.js` which
**automatically compiles the Rust addon** if the binary is missing. The first compile
takes 60–120 seconds; subsequent runs are instant (Cargo caches).

If Rust is not installed, the script prints a warning and exits cleanly — the rest of the
install still succeeds. You can build the native addon later with:

```bash
npm run build:native
```

### 2. Copy the environment file

```bash
cp server/.env.example server/.env
```

Edit `server/.env` to point at your media folders:

```env
MEDIA_PATHS=/Users/Munyaneza/Desktop/MEDIAS/MUSIC,/Users/Munyaneza/Desktop/MEDIAS/VIDEOS
PORT=3001
DATABASE_PATH=./data/media.db
```

---

## Daily development

### Start everything

```bash
npm run dev
```

This runs `predev` (native check) then starts frontend and server in parallel via
`concurrently`. You will see colour-coded output:

```
[frontend] VITE v7  ready in 309ms  → http://localhost:8080/
[server]   Zovyra Server running on port 3001
```

Both processes hot-reload on file save. Stop with `Ctrl+C`.

### Start only one side

```bash
npm run dev:frontend   # Vite only → http://localhost:8080
npm run dev:server     # ts-node-dev only → http://localhost:3001
```

---

## What `scripts/check-native.js` does

Called automatically by three hooks:

| Hook | When it fires |
|------|---------------|
| `postinstall` | After `npm install` in the root |
| `predev` | Before `npm run dev` |
| `prebuild` | Before `npm run build` |

Logic:

1. Looks for `native/zovyra-native.<platform>.node`
2. **Found** → prints `✔ Native addon ready.` and exits
3. **Not found + Rust installed** → runs `npm run build` inside `native/`, verifies the binary appeared, exits
4. **Not found + Rust missing** → prints install instructions, exits `0` (non-fatal so CI pipelines that ship pre-built binaries keep working)

You never have to think about this manually.

---

## Production build

```bash
npm run build
```

Order: `native` → `server` (TypeScript compile) → `frontend` (Vite bundle).

Output:

```
native/   zovyra-native.<platform>.node   (Rust binary)
server/   dist/                           (compiled JS)
frontend/ dist/                           (static assets)
```

### Preview the production build locally

```bash
npm start
```

Starts `vite preview` (frontend) and `node dist/src/index.js` (server) concurrently.

---

## Running tests

```bash
npm test
```

Runs the server Jest suite (`server/tests/`). Requires no native binary — tests use the
SQLite layer directly.

---

## Linting

```bash
npm run lint        # frontend ESLint + server ESLint
cd frontend && npm run format    # Prettier
```

---

## Rebuilding the native addon

You only need this after editing `native/src/lib.rs` or `native/Cargo.toml`.

```bash
npm run build:native
```

Or manually:

```bash
cd native
npm run build          # release build
npm run build:debug    # debug build (faster compile, slower runtime)
```

---

## Clean reinstall

Wipes `dist/`, `node_modules/`, lock files, and the compiled `.node` binary across all
packages, then reinstalls from scratch.

```bash
npm run reinstall
```

---

## Troubleshooting

### `Cannot find module 'zovyra-native-darwin-x64'`

The `.node` binary is missing. Run:

```bash
npm run build:native
```

If that fails with `cargo: command not found`, install Rust first:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
npm run build:native
```

---

### `ts-node-dev: command not found`

```bash
cd server && npm install
```

`ts-node-dev` is a devDependency of the server package — it must be installed inside
`server/node_modules`, not globally.

---

### Port already in use

```bash
# Kill whatever is on port 3001
lsof -ti:3001 | xargs kill -9

# Kill whatever is on port 8080
lsof -ti:8080 | xargs kill -9
```

Or change the ports in `server/.env` (`PORT=`) and `frontend/vite.config.ts` (`server.port`).

---

### Frontend can't reach the server (CORS / 404 on `/api/…`)

Check that `CORS_ORIGINS` in `server/.env` includes your frontend URL:

```env
CORS_ORIGINS=http://localhost:8080,http://localhost:3000
```

And that your frontend `VITE_API_URL` (or equivalent) points to `http://localhost:3001`.

---

### SQLite `SQLITE_CANTOPEN` on first run

The server auto-creates the database directory. If it fails, create it manually:

```bash
mkdir -p server/data
```

---

## Common commands — quick reference

| Command | What it does |
|---------|--------------|
| `npm run install:all` | Install deps in all four packages |
| `npm run dev` | Start frontend + server in dev mode |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:server` | Server only |
| `npm run build` | Production build (native → server → frontend) |
| `npm run build:native` | Rebuild Rust addon only |
| `npm start` | Preview production build locally |
| `npm test` | Run server tests |
| `npm run lint` | Lint frontend + server |
| `npm run clean` | Remove all build artefacts |
| `npm run reinstall` | Full clean + reinstall |