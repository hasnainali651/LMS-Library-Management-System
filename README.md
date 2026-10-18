<p align="center">
  <img src="frontend/public/nextgen_lms.webp" alt="NextGen LMS logo" width="180" />
</p>

<h1 align="center">NextGen LMS</h1>

<p align="center">
  A modern library management platform for readers, librarians, and administrators.
</p>

<p align="center">
  <img src="frontend/public/nextgen_lms0.png" alt="NextGen LMS brand mark" width="96" />
</p>

NextGen LMS brings a library's catalog, circulation desk, and patron services into
one web application. Readers can discover books and manage loans, while library
staff get tools for circulation, reservations, members, fines, and reporting.

## What the app does

- **Book discovery:** Browse and search the catalog, filter by category, and see
  availability and shelf locations.
- **Patron accounts:** Register, sign in, verify email, reset passwords, and
  manage profile information.
- **Circulation:** Track checkouts, returns, due dates, loan history, and
  overdue fines.
- **Reservations:** Place and manage holds, follow waitlist position, and track
  pickup deadlines.
- **Staff tools:** Manage books and members, process circulation, review fines
  and overdue loans, and audit shelf inventory.
- **Insights and administration:** View analytics, demand reports, audit logs,
  and system status according to user role.
- **Live updates and automation:** Synchronize inventory events and run
  background tasks for notifications and overdue workflows.
- **AI-assisted discovery:** Generate book summaries with a configured Gemini
  API key.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Data | MongoDB, Mongoose |
| Cache and background jobs | Redis, ioredis, Bull, node-cron |
| Realtime | Socket.IO |
| Authentication and validation | JWT, bcryptjs, express-validator |
| Media processing | Multer, Sharp |
| Email and AI | Nodemailer, Google Gemini API |
| Testing and local services | Jest, Supertest, Docker Compose |

## Project structure

```text
.
├── backend/             # Express API, data models, jobs, and tests
├── frontend/            # Next.js application and brand assets
├── docker-compose.yml   # Local MongoDB, Redis, and backend services
├── package.json         # npm workspaces and convenience scripts
└── README.md
```

The repository contains both application parts for development. The backend and
frontend can also be deployed independently from their respective directories.

## Run locally

### Requirements

- Node.js and npm
- Docker Desktop (for the local MongoDB and Redis services)

### Install dependencies

From the project root:

```bash
npm install
```

### Configure local environment

Use the checked-in `.env.example` files as templates. The Compose setup expects
a local `backend/.env`; create it from `backend/.env.example` and configure it
for your environment before starting the services. Generate fresh, unique JWT
secrets and replace all sample values. Keep real credentials and API keys out
of Git. The frontend's `NEXT_PUBLIC_API_URL` should point to the backend URL you
use locally; it defaults to `http://localhost:5000/api/v1`.

For the Docker Compose setup, prepare its local Redis configuration and start
the services from the project root:

```bash
npm run docker:prepare --workspace=backend
docker compose --env-file .env.docker.local up -d --build
```

The Compose setup starts MongoDB, Redis, and the backend, using persistent
Docker volumes for database data. The backend is exposed locally on port
`5000`. Start the frontend separately to use it on port `3000`.

### Start the frontend

In a second terminal, from the project root:

```bash
npm run dev:frontend
```

Open [http://localhost:3000](http://localhost:3000).

### Run backend tests

```bash
npm test
```

The backend API health/readiness endpoint is available at
`/api/v1/health` when the backend is running.

## Environment and deployment notes

- Keep `.env`, `.env.local`, `.env.docker.local`, tokens, passwords, and private
  API keys out of public repositories.
- Use strong, unique JWT secrets and production-grade MongoDB and Redis
  credentials when deploying.
- Configure the backend's allowed frontend origin and the frontend's backend
  API URL to match your deployed services.
- Configure SMTP and `GEMINI_API_KEY` only if using email delivery and AI
  summaries.
- Do not use development credentials or local Docker settings in production.

## Brand assets

The brand mark is included in two formats:

- WebP: [`frontend/public/nextgen_lms.webp`](frontend/public/nextgen_lms.webp)
- PNG: [`frontend/public/nextgen_lms0.png`](frontend/public/nextgen_lms0.png)
