# Deploy backend on Render

Render **does** run `npm` — you set **Build** and **Start** in the service settings. Use production commands, not `npm run dev`.

This repo is a **monorepo**: `backend` depends on workspace package `@engintel/telemetry`. Deploy from the **repository root** (do **not** set Render “Root Directory” to `backend` only unless you publish `@engintel/telemetry` to npm).

## Suggested Render settings

- **Runtime:** Node  
- **Root Directory:** *(leave empty = repo root)*  
- **Build command** *(runs once, then exits — this is normal):*  
  `npm ci && npm run render:backend:build`  
- **Start command** *(must be separate — keeps the server alive):*  
  `npm run render:backend:start`

Do **not** put the build command in the Start field. After build you should see the shell return / deploy move to "Starting"; the API stays up only from the start command.

Or import [`render.yaml`](../render.yaml) at the repo root for these defaults.

Optional: Environment → add **NODE_VERSION** = `20`.

## Ports

Backend listens on `process.env.PORT` (Render sets this). Already supported via `backend/src/index.ts`.

## Env vars

Set the same secrets you use locally (`OPENAI_API_KEY`, `GITHUB_TOKEN`, `FRONTEND_URL` / `CORS_ORIGINS`, etc.) in the Render dashboard.
