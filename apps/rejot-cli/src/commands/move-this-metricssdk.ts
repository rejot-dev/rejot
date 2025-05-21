import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { processDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const url = "http://localhost:4318/v1/metrics"; // TODO: get from env

export const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "rejot-cli",
    [ATTR_SERVICE_VERSION]: "0.1.0", // TODO: get version from package.json
  }),
  traceExporter: new OTLPTraceExporter({
    url,
  }),
  metricReader: new PeriodicExportingMetricReader({
    // exporter: new ConsoleMetricExporter(),
    exporter: new OTLPMetricExporter({
      url,
    }),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  resourceDetectors: [processDetector],
});

sdk.start();
