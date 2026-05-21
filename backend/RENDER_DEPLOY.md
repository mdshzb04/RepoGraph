# Deploy backend on Render

Render **does** run `npm` — you set **Build** and **Start** in the service settings. Use production commands, not `npm run dev`.

This repo is a **monorepo**: `backend` depends on workspace package `@engintel/telemetry`. Deploy from the **repository root** (do **not** set Render “Root Directory” to `backend` only unless you publish `@engintel/telemetry` to npm).

## Suggested Render settings

- **Runtime:** Node  
- **Root Directory:** *(leave empty = repo root)*  
- **Build command:**  
  `npm ci && npm run render:backend:build`  
- **Start command:**  
  `npm run render:backend:start`

Optional: Environment → add **NODE_VERSION** = `20`.

## Ports

Backend listens on `process.env.PORT` (Render sets this). Already supported via `backend/src/index.ts`.

## Env vars

Set the same secrets you use locally (`OPENAI_API_KEY`, `GITHUB_TOKEN`, `FRONTEND_URL` / `CORS_ORIGINS`, etc.) in the Render dashboard.
