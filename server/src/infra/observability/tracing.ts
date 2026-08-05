import { env } from "@/common/config/env.ts"

let shutdownTracing: (() => Promise<void>) | undefined

if (env.OTEL_ENABLED) {
	const { NodeSDK } = await import("@opentelemetry/sdk-node")
	const { OTLPTraceExporter } =
		await import("@opentelemetry/exporter-trace-otlp-http")
	const { HttpInstrumentation } =
		await import("@opentelemetry/instrumentation-http")
	const { ExpressInstrumentation } =
		await import("@opentelemetry/instrumentation-express")
	const sdk = new NodeSDK({
		serviceName: env.SERVICE_NAME,
		traceExporter: new OTLPTraceExporter({
			url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
		}),
		instrumentations: [
			new HttpInstrumentation(),
			new ExpressInstrumentation(),
		],
	})
	await sdk.start()
	shutdownTracing = async () => {
		await sdk.shutdown()
	}
}

export async function stopTracing(): Promise<void> {
	await shutdownTracing?.()
}
