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
4. **GitHub OAuth:** GitHub App callback `https://repograph.shazeb.site/api/auth/callback/github`. Vercel env: `AUTH_URL=https://repograph.shazeb.site`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (or `NEXTAUTH_*` / `GITHUB_*` aliases).
5. Do **not** override install/build with a second `npm ci` in the build step — that can omit devDependencies and break PostCSS.

### Backend (Railway / Render)

1. Deploy from repo root (see `render.yaml`) or `backend/` as a Node service.
2. Set env from `backend/.env.example`, especially:
   - **`DATABASE_URL`** — Neon PostgreSQL pooled connection string (`*.neon.tech`). **Remove any old Supabase URL** from Render → Environment.
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CORS_ORIGINS` / `FRONTEND_URL`
3. Start: `npm start` → `node dist/index.js`  
   On Render use `render:backend:build` (includes `prisma db push`) and `render:backend:start`.

Indexed repositories, embeddings, and index jobs are stored in **Neon PostgreSQL** via Prisma (`backend/prisma/schema.prisma`). Set `DATABASE_URL` locally in `backend/.env` and in Render/Railway for production. Legacy JSON under `backend/data/repos/` can be imported with `npm run db:migrate-json --prefix backend`.

## Grafana Cloud (optional)

Export metrics, traces, and logs from the **backend** via OTLP:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-ap-south-1.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic YOUR_BASE64_CREDENTIALS
OTEL_SERVICE_NAME=repograph-backend
OTEL_DEPLOYMENT_ENVIRONMENT=production
OTEL_RESOURCE_ATTRIBUTES=service.namespace=repograph
OTEL_TRACES_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_METRICS_EXPORTER=none
```

On Render, also set `NODE_OPTIONS=--require @opentelemetry/auto-instrumentations-node/register` or use the backend `start` script (already includes `-r`).

Check: `GET /health` or `GET /api/telemetry/status`.

## Health & smoke test

- `GET /health` — API up
- Index a public repo (e.g. `vercel/next.js`) in the UI to verify GitHub + OpenAI

<img width="836" height="520" alt="image" src="https://github.com/user-attachments/assets/161856f1-1056-4fb6-88ad-9dd69a8b89de" />



https://github.com/user-attachments/assets/bdcf5571-061a-4450-a6b8-ae9ded94e52d









## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend offline in UI | Set `BACKEND_URL` in frontend env; check `CORS_ORIGINS` on API |
| GitHub rate limit | Add `GITHUB_TOKEN` to `backend/.env`, restart API, re-index |
| Empty architecture | Wait for indexing to finish, then open Architecture tab |


## License

Private — all rights reserved unless otherwise noted in the repository.
# RepoGraph
