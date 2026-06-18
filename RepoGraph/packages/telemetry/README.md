# @engintel/telemetry

Lightweight OpenTelemetry metrics for **Grafana Cloud** (OTLP HTTP). Used by the Express backend only.

## Enable

```env
OTEL_ENABLED=true
GRAFANA_CLOUD_INSTANCE_ID=123456
GRAFANA_CLOUD_API_KEY=glc_xxx
GRAFANA_CLOUD_OTLP_REGION=prod-us-east-0
OTEL_SERVICE_NAME=engintel-api
```

If credentials are missing, all `record*` calls are no-ops.

## Metrics

All metrics export to Grafana Cloud when configured; local cumulative counters always update for the Observability UI.

- `engintel.api.request.duration` / `.total` / `.errors`
- `engintel.repo_index.completed_total` — +1 per successful index sync only
- `engintel.repo.index.duration` / `.files` / `.chunks` / `.activity`
- `engintel.vector.search.duration` / `.total`
- `engintel.openai.tokens` / `.requests`
- `engintel.traces.events`
- `engintel.platform.uptime`

Import dashboard: `grafana/dashboards/engintel-platform.json`

## Build

```bash
npm run build -w @engintel/telemetry
```
