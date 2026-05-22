# EngIntel

AI engineering intelligence platform: index GitHub repositories, chat over code context, and explore architecture, deployments, and observability from one workspace.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19 |
| Backend | Express, TypeScript |
| AI | OpenAI (indexing, chat, summaries) |
| Telemetry | OpenTelemetry → Grafana Cloud (optional) |

Monorepo workspaces: `frontend/`, `backend/`, `packages/telemetry/`.

## Features

- **Copilot** — RAG chat over indexed repos
- **Knowledge** — semantic search and file index
- **Architecture** — system topology, service dependency map, Mermaid module graph
- **Deployments** — readiness checks and hosting hints
- **Observability** — OpenTelemetry metrics, latency, token/cost usage, traces, vector search

## Prerequisites

- Node.js 20+
- `OPENAI_API_KEY` (required for indexing and chat)
- `GITHUB_TOKEN` (recommended for private repos and higher API limits)

## Local setup

```bash
git clone <your-repo-url>
cd p1

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Add OPENAI_API_KEY, GITHUB_TOKEN, and BACKEND_URL=http://localhost:8000

npm install
npm run dev
```

- App: http://localhost:3000  
- API: http://localhost:8000  

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend + backend (concurrent) |
| `npm run build` | Build telemetry package, backend, frontend |
| `npm run start` | Production start (both services) |

## Production deploy

### Frontend (Vercel)

1. Import the **repository root** (not `frontend/` alone) so workspace package `@engintel/telemetry` resolves.
2. Leave **Root Directory** empty (or `.`). `vercel.json` sets install/build for the monorepo.
3. Set env from `frontend/.env.example`, especially `BACKEND_URL` (your API URL).
4. Do **not** override install/build with a second `npm ci` in the build step — that can omit devDependencies and break PostCSS.

### Backend (Railway / Render)

1. Deploy `backend/` as a Node service.
2. Set env from `backend/.env.example`: `OPENAI_API_KEY`, `GITHUB_TOKEN`, `CORS_ORIGINS` (your Vercel URL).
3. Start: `npm start` → `node dist/index.js`  
   On Render you can use root scripts `render:backend:build` and `render:backend:start`.

Indexed repositories are stored on the API filesystem at `backend/data/repos/` unless you wire Supabase/pgvector (`backend/supabase/migrations/`).

## Grafana Cloud (optional)

Export metrics from the **backend** only via OTLP:

```env
OTEL_ENABLED=true
GRAFANA_CLOUD_INSTANCE_ID=
GRAFANA_CLOUD_API_KEY=
GRAFANA_CLOUD_OTLP_REGION=prod-us-east-0
GRAFANA_CLOUD_DASHBOARD_URL=
OTEL_SERVICE_NAME=engintel-api
OTEL_DEPLOYMENT_ENVIRONMENT=production
```

Check: `GET /health` or `GET /api/telemetry/status`.

## Health & smoke test

- `GET /health` — API up
- Index a public repo (e.g. `vercel/next.js`) in the UI to verify GitHub + OpenAI

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend offline in UI | Set `BACKEND_URL` in frontend env; check `CORS_ORIGINS` on API |
| GitHub rate limit | Add `GITHUB_TOKEN` to `backend/.env`, restart API, re-index |
| Empty architecture | Wait for indexing to finish, then open Architecture tab |

## License

Private — all rights reserved unless otherwise noted in the repository.
# RepoGraph
