import assert from "node:assert/strict"
import test from "node:test"
import { once, EventEmitter } from "node:events"
import { createServer } from "node:http"
import http from "node:http"
import https from "node:https"
import dns from "node:dns/promises"
import { syncBuiltinESMExports } from "node:module"
import { createServer as createTcpServer, type AddressInfo, type Socket } from "node:net"
import { env } from "@/common/config/env.ts"
import { assertSafeWebhookUrl, postSafeWebhook } from "./webhook.util.ts"

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test("webhook completes success and redirect once, and bounds idle, trickle, truncated and oversized bodies", { timeout: 5_000 }, async (t) => {
	const timers = new Set<NodeJS.Timeout>()
	const originalSetTimeout = globalThis.setTimeout
	const originalClearTimeout = globalThis.clearTimeout
	t.mock.method(globalThis, "setTimeout", (callback: () => void, delay?: number) => {
		const timer = originalSetTimeout(callback, delay)
		if (delay === 80) timers.add(timer)
		return timer
	})
	t.mock.method(globalThis, "clearTimeout", (timer: NodeJS.Timeout) => { timers.delete(timer); originalClearTimeout(timer) })
	for (const mode of ["success", "redirect", "idle", "trickle", "truncated", "oversize"] as const) {
		const sockets = new Set<Socket>()
		let requests = 0
		const server = createServer((req, res) => {
			requests++
			assert.equal(req.method, "POST")
			assert.equal(req.headers["content-length"], "2")
			if (mode === "success") { res.end("ok"); return }
			if (mode === "redirect") { res.writeHead(302, { location: "/redirect-target" }); res.end(); return }
			if (mode === "oversize") { res.end("0123456789"); return }
			if (mode === "truncated") { res.writeHead(200, { "content-length": "100" }); res.write("short"); setImmediate(() => res.destroy()); return }
			res.writeHead(200); res.flushHeaders()
			if (mode === "trickle") {
				const timer = setInterval(() => res.write("x"), 10)
				res.on("close", () => clearInterval(timer))
			}
		})
		server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)) })
		server.listen(0, "127.0.0.1")
		await once(server, "listening")
		try {
			const start = performance.now()
			const pending = postSafeWebhook(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, "{}", {}, 80, mode === "oversize" ? 5 : 1024)
			if (mode === "success" || mode === "redirect") {
				const result = await pending
				assert.equal(result.status, mode === "success" ? 200 : 302)
				assert.equal(result.body, mode === "success" ? "ok" : "")
			} else {
				await assert.rejects(pending, mode === "oversize" ? /exceeded size limit/ : mode === "truncated" ? /aborted|reset|closed/i : /timed out/)
			}
			assert.ok(performance.now() - start < 500, `${mode} must settle promptly`)
			for (let i = 0; sockets.size > 0 && i < 50; i++) await pause(5)
			assert.equal(sockets.size, 0, `${mode} leaves no receiver socket`)
			assert.equal(requests, 1, "redirects are not followed")
			assert.equal(timers.size, 0, `${mode} clears total-deadline timer`)
		} finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
	}
})

test("webhook total deadline includes DNS and prevents late lookup from creating a socket", { timeout: 2_000 }, async (t) => {
	const originalEnv = env.NODE_ENV
	env.NODE_ENV = "development"
	let release!: (addresses: Array<{ address: string; family: number }>) => void
	let calls = 0
	t.mock.method(dns, "lookup", () => new Promise(resolve => { release = resolve }))
	t.mock.method(http, "request", () => { calls++; throw new Error("late request") })
	syncBuiltinESMExports()
	try {
		const start = performance.now()
		await assert.rejects(postSafeWebhook("http://dns-stall.example.test/", "{}", {}, 50, 1024), /timed out/)
		assert.ok(performance.now() - start < 300)
		release([{ address: "8.8.8.8", family: 4 }])
		await pause(20)
		assert.equal(calls, 0)
	} finally { env.NODE_ENV = originalEnv; t.mock.restoreAll(); syncBuiltinESMExports() }
})

test("webhook connection stall destroys its request and keeps checked IP, Host and TLS validation", { timeout: 2_000 }, async (t) => {
	const originalEnv = env.NODE_ENV
	env.NODE_ENV = "development"
	let destroyed = 0
	let captured: https.RequestOptions | undefined
	const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void }
	req.end = () => {}
	req.destroy = () => { destroyed++ }
	t.mock.method(dns, "lookup", async () => [{ address: "8.8.8.8", family: 4 }])
	t.mock.method(https, "request", (options: https.RequestOptions) => { captured = options; return req })
	syncBuiltinESMExports()
	try {
		await assert.rejects(postSafeWebhook("https://checked.example.test/path?q=1", "{}", {}, 50, 1024), /timed out/)
		assert.equal(destroyed, 1)
		assert.equal(captured?.host, "8.8.8.8")
		assert.equal(captured?.servername, "checked.example.test")
		assert.equal(captured?.rejectUnauthorized, true)
		assert.equal(captured?.agent, false)
		assert.equal(captured?.path, "/path?q=1")
		assert.equal((captured?.headers as Record<string, string>).host, "checked.example.test")
		t.mock.restoreAll(); syncBuiltinESMExports()
		t.mock.method(dns, "lookup", async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }])
		syncBuiltinESMExports()
		await assert.rejects(assertSafeWebhookUrl("https://mixed.example.test"), /private network/)
		await assert.rejects(assertSafeWebhookUrl("https://user:secret@example.test"), /credentials/)
	} finally { env.NODE_ENV = originalEnv; t.mock.restoreAll(); syncBuiltinESMExports() }
})


test("webhook closes a real TLS connection stalled before handshake", { timeout: 2_000 }, async () => {
	const sockets = new Set<Socket>()
	const receiver = createTcpServer(socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.resume() })
	receiver.listen(0, "127.0.0.1")
	await once(receiver, "listening")
	try {
		const started = performance.now()
		await assert.rejects(postSafeWebhook(`https://127.0.0.1:${(receiver.address() as AddressInfo).port}`, "{}", {}, 80, 1024), /timed out/)
		assert.ok(performance.now() - started < 500)
		for (let i = 0; sockets.size > 0 && i < 50; i++) await pause(5)
		assert.equal(sockets.size, 0, "deadline destroys the stalled TLS socket")
	} finally { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => receiver.close(() => resolve())) }
})
