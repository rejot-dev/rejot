import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { processDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const metricsPort = process.env["REJOT_METRICS_PORT"];
const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

if (metricsPort && otlpEndpoint) {
  console.warn(
    "REJOT_METRICS_PORT and OTEL_EXPORTER_OTLP_ENDPOINT are set. OTEL_EXPORTER_OTLP_ENDPOINT will be ignored.",
  );
}

if (metricsPort || otlpEndpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "rejot-cli",
      [ATTR_SERVICE_VERSION]: "0.1.0", // TODO: get version from package.json
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: metricsPort
      ? new PrometheusExporter({
          port: +metricsPort,
        })
      : new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
        }),
    resourceDetectors: [processDetector],
  });

  sdk.start();
}
