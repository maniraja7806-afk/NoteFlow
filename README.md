# NoteFlow

A high-performance, **collaborative note-taking application** with rich-text editing, live multi-user presence, full version history, granular sharing, and full-text search.

> Backend: Node.js · Express · Mongoose (MongoDB) · Socket.IO — all in TypeScript
> Frontend: React (Vite) · TypeScript · Tailwind CSS · Framer Motion · TipTap

---

## Features

- **Rich-text editor** (TipTap headless) with a floating bubble toolbar — bold, italic, strike, code, headings, lists, quotes, links.
- **Real-time collaboration** via Socket.IO — live presence avatars, debounced co-editing, Last-Write-Wins conflict handling.
- **Automatic version history** — every save snapshots an immutable `NoteVersion`; preview & restore any version from a vertical timeline.
- **Granular sharing** — share by email with `read` / `write` permissions; owner-only management.
- **Powerful search** — MongoDB `$text` search across title + content, with filters for tag, color, pinned, plus multiple sort modes.
- **Soft delete / Trash** — restore or permanently delete notes.
- **Pinning, tags, color coding** with smooth Framer Motion animations.
- **Auth** — JWT + bcrypt, protected REST routes and authenticated sockets.
- **Security** — Helmet, CORS allow-listing, rate limiting, request validation, and HTML sanitization (DOMPurify) to prevent stored XSS.
- **Modern UI** — glassmorphism, dark/light mode.

---

## Project structure

```
NoteFlow/
├── server/                 # Express + Socket.IO API (TypeScript)
│   └── src/
│       ├── config/         # env + Mongo connection
│       ├── models/         # User, Note (versioning hook), NoteVersion
│       ├── middleware/     # auth, accessControl, error handling, rate limit, validate
│       ├── controllers/    # authController, noteController
│       ├── routes/         # authRoutes, noteRoutes
│       ├── sockets/        # noteSocket (presence, live edit), io singleton
│       ├── utils/          # token, sanitize, ApiError, asyncHandler
│       ├── app.ts          # Express app factory
│       └── server.ts       # entry point (HTTP + Socket.IO + DB)
└── client/                 # React + Vite frontend (TypeScript)
    └── src/
        ├── api/            # axios client + typed endpoints
        ├── context/        # Auth, Theme, Toast, Socket providers
        ├── hooks/          # useNotes, useSocket, useDebounce
        ├── components/     # Layout, NoteCard, Editor, VersionTimeline, ShareModal, SearchBar, ...
        ├── pages/          # Login, Register, Dashboard, EditorPage
        └── App.tsx
```

---

## Prerequisites

- **Node.js** ≥ 18 (tested on 20/22)
- **MongoDB** ≥ 6 running locally or a connection string (e.g. MongoDB Atlas)

Quick local Mongo with Docker:

```bash
docker run -d --name noteflow-mongo -p 27017:27017 mongo:7
```

---

## Setup & running (development)

### 1. Configure environment variables

Copy the example file and fill in values. The example contains **both** backend and frontend variables.

```bash
cp .env.example server/.env     # backend reads server/.env
cp .env.example client/.env     # frontend reads client/.env (only VITE_* vars are used)
```

Backend (`server/.env`):

| Variable         | Description                                  | Example                                   |
| ---------------- | -------------------------------------------- | ----------------------------------------- |
| `MONGO_URI`      | MongoDB connection string                    | `mongodb://127.0.0.1:27017/noteflow`      |
| `JWT_SECRET`     | Secret for signing JWTs (use a long random)  | `a-very-long-random-string`               |
| `JWT_EXPIRES_IN` | Token lifetime                               | `7d`                                      |
| `PORT`           | API/Socket.IO port                           | `5000`                                    |
| `CLIENT_URL`     | Allowed CORS origin (frontend URL)           | `http://localhost:5173`                   |
| `NODE_ENV`       | `development` / `production`                  | `development`                             |

Frontend (`client/.env`):

| Variable          | Description            | Example                         |
| ----------------- | ---------------------- | ------------------------------- |
| `VITE_API_URL`    | Base URL of the API    | `http://localhost:5000/api`     |
| `VITE_SOCKET_URL` | Socket.IO server URL   | `http://localhost:5000`         |

### 2. Install dependencies

```bash
# from the repo root — installs both apps
npm run install:all

# or individually
cd server && npm install
cd client && npm install
```

### 3. Start the dev servers

In two terminals (or use the root scripts):

```bash
# terminal 1 — API + Socket.IO with hot reload
npm run dev:server      # http://localhost:5000

# terminal 2 — Vite dev server
npm run dev:client      # http://localhost:5173
```

Open **http://localhost:5173**, register an account, and start writing.

> **Migrations:** none required. Mongoose creates collections and indexes automatically on first connection.

---

## Production build

```bash
# Backend → compiles TS to server/dist
npm run build:server
npm run start            # node server/dist/server.js

# Frontend → static assets in client/dist
npm run build:client     # serve client/dist with any static host
```

---

## API overview

All routes are prefixed with `/api`. Authenticated routes require `Authorization: Bearer <token>`.

### Auth
| Method | Route                 | Description              |
| ------ | --------------------- | ------------------------ |
| POST   | `/auth/register`      | Create account, returns JWT |
| POST   | `/auth/login`         | Log in, returns JWT      |
| GET    | `/auth/me`            | Current user             |
| GET    | `/auth/users?email=`  | Look up a user by email  |

### Notes
| Method | Route                              | Description                          |
| ------ | ---------------------------------- | ------------------------------------ |
| GET    | `/notes`                           | List accessible notes                |
| POST   | `/notes`                           | Create a note                        |
| GET    | `/notes/search`                    | Text search + filters + sort + paging|
| GET    | `/notes/tags`                      | Distinct tags                        |
| GET    | `/notes/trash`                     | List soft-deleted notes              |
| GET    | `/notes/:id`                       | Get a note (access-checked)          |
| PUT    | `/notes/:id`                       | Update (triggers versioning)         |
| DELETE | `/notes/:id`                       | Soft delete                          |
| POST   | `/notes/:id/restore-trash`         | Restore from trash                   |
| DELETE | `/notes/:id/permanent`             | Hard delete (owner)                  |
| GET    | `/notes/:id/history`               | Paginated version history            |
| GET    | `/notes/:id/history/:version`      | Preview a version                    |
| POST   | `/notes/:id/restore/:version`      | Restore a version                    |
| GET    | `/notes/:id/collaborators`         | List collaborators                   |
| POST   | `/notes/:id/share`                 | Share by email (owner)               |
| DELETE | `/notes/:id/share/:userId`         | Remove collaborator (owner)          |

### Socket.IO events
Handshake auth: `io(url, { auth: { token } })`.

| Event              | Direction        | Payload                                   |
| ------------------ | ---------------- | ----------------------------------------- |
| `join-note`        | client → server  | `noteId`                                  |
| `leave-note`       | client → server  | `noteId`                                  |
| `edit-note`        | client → server  | `{ noteId, title?, content?, tags?, color? }` (debounced) |
| `presence`         | server → client  | `{ noteId, users }` (sent on join)        |
| `user-joined`      | server → client  | `{ noteId, user, users }`                 |
| `user-left`        | server → client  | `{ noteId, userId, users }`               |
| `broadcast-update` | server → client  | live edits from collaborators             |

---

## Search examples

```
GET /api/notes/search?q=roadmap&tag=work&pinned=true&sort=relevance
GET /api/notes/search?color=%23fde68a&sort=title&order=asc&page=2
```

## Versioning model

Each note carries `currentVersion`. The Mongoose `pre('save')` hook increments it on any title/content/tags/color change; the paired `post('save')` hook writes an immutable `NoteVersion` snapshot. The newest snapshot always mirrors the live note, so the history timeline is complete and gap-free. Restoring a version applies its content and records a **new** version labelled `Restored from vN`.
