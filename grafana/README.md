# Grafana Cloud dashboards

Import [dashboards/engintel-platform.json](./dashboards/engintel-platform.json) into [Grafana Cloud](https://mdshzb04.grafana.net/dashboards):

1. **Dashboards → New → Import**
2. Upload `engintel-platform.json`
3. Select your Prometheus/Mimir data source (OTLP metrics from `engintel-api`)

## Jobs Completed shows 0 in Grafana

The in-app counter included persisted repos; Grafana only saw new OTel exports. On startup the backend now **syncs baseline index counts to OTLP**.

Update your **Engintel Backend Metrics** panel query to:

```promql
sum(increase(engintel_repo_index_completed_total[$__range])) or vector(0)
```

Use **increase / cumulative**, not `rate()`. Restart backend after deploy.

## Per-run index metrics (duration & throughput)

Each completed index emits **Gauge** snapshots with a unique `run_id` label:

- `engintel_repo_index_duration_ms{run_id="..."}`
- `engintel_repo_index_files_total{run_id="..."}`
- `engintel_repo_index_chunks_total{run_id="..."}`

Historical repos hydrated on startup use `run_id="<repoId>@<indexedAt>"`. Live runs use a UUID.

Grafana queries (one series per run):

```promql
sum by (run_id) (engintel_repo_index_duration_ms)
sum by (run_id) (engintel_repo_index_files_total)
sum by (run_id) (engintel_repo_index_chunks_total)
```

Each run also carries an `indexed_at` label (ISO timestamp) for ordering. In bar/panel legends, use `{{run_id}}` or `{{indexed_at}}`.

## Embed in Observability UI

The app embeds this dashboard in the **Observability** tab via iframe.

1. After import, note the dashboard UID (`engintel-platform`) or set `GRAFANA_CLOUD_DASHBOARD_UID` in `backend/.env`.
2. Set `GRAFANA_CLOUD_DASHBOARD_URL=https://mdshzb04.grafana.net/dashboards` (already configured).
3. **Recommended:** enable a [public dashboard](https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/shared-dashboards/) and set:
   ```env
   GRAFANA_CLOUD_EMBED_URL=https://mdshzb04.grafana.net/public-dashboards/your-token
   ```
   This avoids Grafana login inside the iframe.

Without `GRAFANA_CLOUD_EMBED_URL`, the app builds a kiosk URL from the dashboard UID. Users must be logged into Grafana in the same browser, or embedding must be allowed in Grafana instance settings.

Metrics use `or vector(0)` so low-traffic environments show zero instead of empty panels.

OTLP metric names (dots → underscores in Prometheus):
- `engintel_api_request_total`
- `engintel_api_request_duration_*`
- `engintel_api_request_errors`
- `engintel_repo_index_*`
- `engintel_openai_tokens`
- `engintel_vector_search_*`
- `engintel_traces_events`
