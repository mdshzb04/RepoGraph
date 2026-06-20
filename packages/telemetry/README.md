# @engintel/telemetry

Lightweight OpenTelemetry metrics for **Grafana Cloud** (OTLP HTTP). Used by the Express backend only.

## Enable

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

Custom app metrics use this package; traces/logs use `@opentelemetry/auto-instrumentations-node` on the backend.

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
