import assert from "node:assert/strict"
import test from "node:test"
import pino from "pino"
import {
	LOGGER_REDACTION_PATHS,
	logEvent,
	resolveLogLevel,
} from "./logger.ts"
import { currentLogContext, withLogContext } from "./log-context.ts"

test("structured logs redact credentials, identity, prompts, and request bodies", () => {
	let output = ""
	const destination = { write(chunk: string) { output += chunk } }
	const testLogger = pino({ redact: { paths: [...LOGGER_REDACTION_PATHS], censor: "[REDACTED]" } }, destination)
	testLogger.info({
		req: { headers: { authorization: "Bearer secret", cookie: "session=secret", "x-api-key": "key", "x-razorpay-signature": "razorpay-signature-secret" }, body: { content: "private" } },
		providerConfig: { apiKey: "provider-secret", signingSecret: "signing-secret" },
		password: "password-secret",
		prompt: "private prompt",
		email: "person@example.test",
		accessToken: "access-secret",
	}, "redaction probe")
	assert.doesNotMatch(output, /Bearer secret|session=secret|private prompt|person@example\.test|access-secret|password-secret|provider-secret|signing-secret|razorpay-signature-secret|private/)
	assert.match(output, /\[REDACTED\]/)
})

test("structured events include schemas and propagated identifiers", () => {
	let output = ""
	const destination = { write(chunk: string) { output += chunk } }
	const testLogger = pino({ mixin: currentLogContext }, destination)
	withLogContext(
		{ requestId: "req_test", correlationId: "corr_test" },
		() => testLogger.info(
			logEvent("worker", "worker.job.completed", { jobId: "job_test" }, "success"),
		),
	)
	const record = JSON.parse(output) as Record<string, unknown>
	assert.equal(record.schemaVersion, 1)
	assert.equal(record.component, "worker")
	assert.equal(record.event, "worker.job.completed")
	assert.equal(record.requestId, "req_test")
	assert.equal(record.correlationId, "corr_test")
	assert.equal(record.jobId, "job_test")
})

test("production debug logging requires explicit bounded activation", () => {
	assert.equal(resolveLogLevel("production", "debug", false), "info")
	assert.equal(resolveLogLevel("production", "trace", false), "info")
	assert.equal(resolveLogLevel("production", "debug", true), "debug")
	assert.equal(resolveLogLevel("development", "trace", false), "trace")
})
