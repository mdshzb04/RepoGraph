/**
 * Preload before auto-instrumentation so trace resources include
 * deployment.environment (Grafana status checks filter on this attribute).
 */
function mergeDeploymentEnvironment(): void {
  const deploymentEnv = process.env.OTEL_DEPLOYMENT_ENVIRONMENT?.trim();
  if (!deploymentEnv) return;

  const key = "deployment.environment";
  const raw = process.env.OTEL_RESOURCE_ATTRIBUTES?.trim() ?? "";
  const hasKey = raw
    .split(",")
    .some((part) => part.trim().startsWith(`${key}=`));
  if (hasKey) return;

  process.env.OTEL_RESOURCE_ATTRIBUTES = raw
    ? `${raw},${key}=${deploymentEnv}`
    : `${key}=${deploymentEnv}`;
}

mergeDeploymentEnvironment();
require("@opentelemetry/auto-instrumentations-node/register");
