# DeployX


## Live Deployment

Deployed Frontend at: https://deployx-a1l4sf16u-demon08.vercel.app
Deployed Backend at: https://deployx-ssl9.onrender.com

## At a glance

| Metric | Value |
|---|---|
| Frontend frameworks detected | 6 (Next.js, Vite, CRA, Angular, Svelte, static HTML) |
| Backend frameworks/languages detected | 7 (Express, Koa, Fastify, NestJS, Flask, Django, FastAPI, Rails, Go) |
| Deployment providers | 2 (Vercel — direct API, no repo required; Render — via generated `render.yaml`) |
| Token encryption | AES-256-GCM, per-user, per-provider |
| Vercel-recognized framework slugs mapped | 60+ |
| Secret-scan severity tiers | 4 (critical / high / medium / low) |
| API routes | 20+ across auth, repo, deploy, dashboard, connections |
| Core pages | 9 (Dashboard, New Repository, New Deployment, My Repositories, My Deployments, Activity, Settings, Profile, Login) |

## What it does

- **GitHub push, no local git required** — OAuth login, repo creation, and file push via the Git Data API (blob → tree → commit).
- **Deployment Intelligence Engine** — inspects `package.json` / `requirements.txt` / file structure to classify the project and estimate a hosting cost tier.
- **Provider routing, not one-size-fits-all**:
  - Frontend-only → **Vercel**, deployed directly from files, zero repo needed.
  - Backend / fullstack → pushed to **GitHub**, with a `render.yaml` Blueprint auto-generated and committed so **Render**'s setup screen is pre-filled.
- **Secret scanner** — blocks deployment if credentials are found outside `.env` files.
- **AI build-failure diagnosis** — failed builds get their logs summarized into a root cause + fix by an LLM, not just a raw stack trace.
- **Per-user OAuth everywhere** — GitHub and Vercel tokens are account-scoped and encrypted at rest; no shared server-side credential ever deploys on a user's behalf.

## How it works

1. Select a project folder — no `.git` needed.
2. The Intelligence Engine detects frontend/backend stack, scans for secrets, flags missing env vars, estimates cost.
3. Routing decision:
   - **Frontend-only** → instant Vercel deploy.
   - **Backend/fullstack** → GitHub repo created, `render.yaml` included in the first commit for Render.
4. Deploy status is polled live; failures trigger automatic AI log analysis.


## Tech Stack

## Frontend
- **Framework:** React (Vite)
- **Styling:** Tailwind CSS
- **Routing:** React Router
- **Icons:** Lucide React
- **Charts/visuals:** Custom SVG — contribution heatmap, weekly bar chart, success ring (no charting library dependency)

## Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Auth:** Passport.js (`passport-github2`), session-based
- **GitHub API client:** Octokit (`@octokit/rest`) — Git Data API for blob/tree/commit-level pushes
- **HTTP client:** Axios
- **Database (tokens):** SQLite (`better-sqlite3`), WAL mode
- **Database (deployment records):** JSON file store

## Security
- **Token encryption:** AES-256-GCM, per-user per-provider, unique IV per row
- **OAuth scope (GitHub):** `user:email`, `repo`, `delete_repo`
- **Secret scanning:** Custom scanner, 4 severity tiers, blocks deploy on unresolved findings outside `.env`
- **Redirect safety:** Same-origin-only `returnTo`/`state` sanitization on the Vercel OAuth round-trip

## External APIs
- **GitHub REST API** — OAuth, repo CRUD, Git Data API, commit history
- **Vercel REST API (`v13/deployments`)** — direct file-based frontend deployment, no repo required
- **Render API** — backend service creation via `render.yaml` Blueprint
- **Google Gemini API** — AI build-log failure analysis

## Deployment intelligence
- **Frontend frameworks detected (6):** Next.js, Vite, Create React App, Angular, Svelte, static HTML
- **Backend frameworks/languages detected:** Express, Koa, Fastify, NestJS (Node) · Flask, Django, FastAPI (Python) · Rails (Ruby) · Go
- **ML dependency signatures (12):** TensorFlow, PyTorch, scikit-learn, Keras, Transformers, XGBoost, LightGBM, ONNX Runtime, OpenCV, Pandas, NumPy, and related packages
- **Vercel framework slugs mapped:** 60+, validated against Vercel's closed enum before every deploy request

## Infra notes
- Repo-less deploys are possible for frontend-only projects because Vercel's Deployments API accepts inlined file content; Render has no equivalent, so backend/fullstack projects are routed through a real GitHub push instead.
- Monorepo support: file paths are re-rooted server-side (via each framework's detected `rootDir`) before upload, so a nested `frontend/` folder in a fullstack repo doesn't break Vercel's expectation of `package.json` at the top level.

## Getting started

### Prerequisites
- Node.js 18+
- GitHub OAuth App
- Vercel Integration (Client ID/Secret + Install URL)
- Render API key (optional — backend hand-off links)
- Gemini API key (AI log analysis)

### Install

```bash
git clone https://github.com/<your-username>/deployx.git
cd deployx

cd backend && npm install
cd ../frontend && npm install
```

### Environment — `backend/.env`

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:5002/auth/github/callback

SESSION_SECRET=

VERCEL_CLIENT_ID=
VERCEL_CLIENT_SECRET=
VERCEL_INSTALL_URL=
APP_BASE_URL=http://localhost:5002

RENDER_API_KEY=
GEMINI_API_KEY=
TOKEN_ENCRYPTION_KEY=

CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

### Environment — `frontend/.env`

```env
VITE_API_URL=http://localhost:5002
```

### Run

```bash
# backend/
node server.js

# frontend/ (separate terminal)
npm run dev
```

Visit `http://localhost:5173`.

## Project structure

```
deployx/
├── backend/
│   ├── routes/       # repo, deploy, dashboard, connections
│   ├── store/        # SQLite token store (encrypted), JSON deployment store
│   ├── utils/        # framework detection, secret scanning
│   └── server.js
└── frontend/
    └── src/components/
```

## License

*(Add your license — MIT is a common default.)*

## Setup

```bash
npm install
npm start
```

## Setup

```bash
npm install
npm start
```
