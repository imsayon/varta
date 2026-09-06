import { env } from "@/common/config/env.ts"
import { context, propagation, trace, SpanStatusCode } from "@opentelemetry/api"
import type { NextFunction, Request, Response } from "express"

let shutdownTracing: (() => Promise<void>) | undefined

if (env.OTEL_ENABLED) {
	const { NodeSDK, tracing } = await import("@opentelemetry/sdk-node")
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
			timeoutMillis: env.OTEL_EXPORT_TIMEOUT_MS,
		}),
		sampler: new tracing.ParentBasedSampler({
			root: new tracing.TraceIdRatioBasedSampler(env.OTEL_SAMPLE_RATIO),
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

export function currentTraceparent(): string | undefined {
	const carrier: Record<string, string> = {}
	propagation.inject(context.active(), carrier)
	return carrier.traceparent
}

export function traceHttpRequest(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const carrier = {
		...(typeof req.headers.traceparent === "string"
			? { traceparent: req.headers.traceparent }
			: {}),
		...(typeof req.headers.tracestate === "string"
			? { tracestate: req.headers.tracestate }
			: {}),
	}
	const parent = propagation.extract(context.active(), carrier)
	const span = trace.getTracer("varta").startSpan(
		"http.server.request",
		{
			attributes: {
				"http.request.method": req.method,
				"server.address": req.hostname,
			},
		},
		parent,
	)
	const activeContext = trace.setSpan(parent, span)
	let ended = false
	const endSpan = () => {
		if (ended) return
		ended = true
		span.setAttribute("http.response.status_code", res.statusCode)
		if (res.statusCode >= 500)
			span.setStatus({ code: SpanStatusCode.ERROR })
		span.end()
	}
	res.once("finish", endSpan)
	res.once("close", endSpan)
	context.with(activeContext, next)
}

export async function withRemoteTrace<T>(
	traceparent: string | undefined,
	name: string,
	attributes: Record<string, string>,
	operation: () => Promise<T>,
): Promise<T> {
	const parent = traceparent
		? propagation.extract(context.active(), { traceparent })
		: context.active()
	return context.with(parent, () => withTrace(name, attributes, operation))
}

export async function withTrace<T>(
	name: string,
	attributes: Record<string, string>,
	operation: () => Promise<T>,
): Promise<T> {
	return trace
		.getTracer("varta")
		.startActiveSpan(name, { attributes }, async (span) => {
			try {
				return await operation()
			} catch (error) {
				span.recordException(
					error instanceof Error
						? error
						: new Error("Unknown traced failure"),
				)
				span.setStatus({ code: SpanStatusCode.ERROR })
				throw error
			} finally {
				span.end()
			}
		})
}
