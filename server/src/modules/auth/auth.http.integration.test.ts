import assert from "node:assert/strict"
import { createHmac, randomUUID } from "node:crypto"
import { once } from "node:events"
import test from "node:test"
import { Prisma } from "@prisma/client"

const enabled = process.env.RUN_AUTH_DATABASE_TESTS === "true"

test("full app preserves API-key, provider callback, and refresh logout authority", { skip: !enabled }, async (t) => {
	// Supply a synthetic callback secret when the standard CI environment has none.
	process.env.RESEND_WEBHOOK_SECRET ||= `whsec_${Buffer.from("auth-http-synthetic-secret").toString("base64")}`
	const [{ app }, { prisma, disconnectDatabase }, { connectRedis, disconnectRedis, redis }, { closeQueues }, { apiKeyService }, { authService }, { authRepository }, { generateRefreshToken, generateAccessToken }, { hashToken }, { hashEmailToken }, { env }] = await Promise.all([
		import("@/app.ts"),
		import("@/infra/database/prisma.ts"),
		import("@/infra/redis/redis.connection.ts"),
		import("@/infra/queues/queue.factory.ts"),
		import("@/modules/api-keys/api-key.service.ts"),
		import("./auth.service.ts"),
		import("./auth.repository.ts"),
		import("@/common/utils/auth/jwt.ts"),
		import("@/common/utils/auth/token-hash.ts"),
		import("@/common/utils/auth/email-token.ts"),
		import("@/common/config/env.ts"),
	])
	await connectRedis()
	const marker = randomUUID()
	const user = await prisma.user.create({ data: { email: `auth-http-${marker}@example.test`, name: "Auth HTTP fixture", emailVerified: true } })
	const workspace = await prisma.workspace.create({ data: { name: "Auth HTTP fixture", slug: `auth-http-${marker}`, members: { create: { userId: user.id, role: "OWNER" } } } })
	const otherWorkspace = await prisma.workspace.create({ data: { name: "Other tenant", slug: `auth-http-other-${marker}` } })
	const eventId = `evt_auth_${marker}`
	const server = app.listen(0, "127.0.0.1")
	await once(server, "listening")
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const origin = `http://127.0.0.1:${address.port}`
	const request = async (path: string, init?: RequestInit) => {
		const response = await fetch(`${origin}${path}`, init)
		await response.text()
		return response
	}
	const createSession = async () => {
		const session = await prisma.session.create({ data: { userId: user.id } })
		const id = randomUUID()
		const token = await generateRefreshToken({ sub: user.id, sessionId: session.id, jti: id })
		await prisma.refreshToken.create({ data: { id, sessionId: session.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) } })
		return { session, id, token }
	}
	try {
		await t.test("key-only requests reach subscriber and trigger policies in the full app", async () => {
			const key = await apiKeyService.create(workspace.id, "Full app key", ["subscribers:read", "notifications:trigger", "notifications:retry"])
			const readOnly = await apiKeyService.create(workspace.id, "Read only key", ["subscribers:read"])
			const headers = { "x-api-key": key.fullKey, "content-type": "application/json" }
			const subscribers = `/api/v1/workspaces/${workspace.id}/subscribers`
			const trigger = `/api/v1/workspaces/${workspace.id}/notifications/trigger`
			assert.equal((await request(subscribers, { headers })).status, 200)
			// Invalid input still exercises validation before acceptance.
			assert.equal((await request(trigger, { method: "POST", headers, body: "{}" })).status, 400)
			assert.equal((await request(`/api/v1/workspaces/${otherWorkspace.id}/subscribers`, { headers })).status, 404)
			assert.equal((await request(`/api/v1/workspaces/${otherWorkspace.id}/notifications/trigger`, { method: "POST", headers, body: "{}" })).status, 404)
			assert.equal((await request(trigger, { method: "POST", headers: { ...headers, "x-api-key": readOnly.fullKey }, body: "{}" })).status, 403)
			assert.equal((await request(`/api/v1/workspaces/${workspace.id}`, { headers })).status, 401)

			const template = await prisma.template.create({ data: { workspaceId: workspace.id, name: "Key-only IN_APP", channels: { inapp: { title: "Auth fixture", body: "Synthetic only" } } } })
			const subscriber = await prisma.subscriber.create({ data: { workspaceId: workspace.id, externalId: `auth-http-${marker}` } })
			const idempotencyKey = randomUUID()
			const body = JSON.stringify({ templateId: template.id, subscriberExternalId: subscriber.externalId, payload: {}, options: { channels: ["IN_APP"] } })
			const postTrigger = () => fetch(`${origin}${trigger}`, { method: "POST", headers: { ...headers, "Idempotency-Key": idempotencyKey }, body })
			const accepted = await postTrigger()
			assert.equal(accepted.status, 202)
			const first = (await accepted.json() as { data: { notificationId: string; channels: string[]; duplicate: boolean } }).data
			assert.deepEqual(first.channels, ["IN_APP"])
			assert.equal(first.duplicate, false)
			const replay = await postTrigger()
			assert.equal(replay.status, 202)
			const duplicate = (await replay.json() as { data: typeof first }).data
			assert.equal(duplicate.notificationId, first.notificationId)
			assert.equal(duplicate.duplicate, true)
			assert.equal(await prisma.notification.count({ where: { workspaceId: workspace.id, idempotencyKey } }), 1)
			assert.equal(await prisma.delivery.count({ where: { notificationId: first.notificationId, channel: "IN_APP" } }), 1)
			assert.equal(await prisma.usageLedger.count({ where: { operationId: `notification:${workspace.id}:${idempotencyKey}` } }), 1)

			const retry = `/api/v1/workspaces/${workspace.id}/notifications/${first.notificationId}/retry`
			assert.equal((await request(retry, { method: "POST", headers: { ...headers, "x-api-key": readOnly.fullKey } })).status, 403)
			assert.equal((await request(`/api/v1/workspaces/${otherWorkspace.id}/notifications/${first.notificationId}/retry`, { method: "POST", headers })).status, 404)
			assert.equal((await request(retry, { method: "POST", headers })).status, 400, "only failed notifications may be resent")
			await prisma.notification.update({ where: { id: first.notificationId }, data: { status: "FAILED" } })
			const resent = await fetch(`${origin}${retry}`, { method: "POST", headers })
			assert.equal(resent.status, 202)
			const second = (await resent.json() as { data: typeof first }).data
			assert.notEqual(second.notificationId, first.notificationId)
			assert.deepEqual(second.channels, ["IN_APP"])
			assert.equal(await prisma.notification.count({ where: { workspaceId: workspace.id } }), 2)
			assert.equal(await prisma.outboxIntent.count({ where: { delivery: { workspaceId: workspace.id } } }), 2)
			assert.equal(await prisma.usageLedger.count({ where: { workspaceId: workspace.id } }), 2)

			await apiKeyService.revoke(workspace.id, key.id)
			assert.equal((await request(subscribers, { headers })).status, 401)
			assert.equal((await request(trigger, { method: "POST", headers, body: "{}" })).status, 401)
			assert.equal((await request(retry, { method: "POST", headers })).status, 401)
		})

		await t.test("signed Resend callbacks bypass browser auth while billing remains protected", async () => {
			const raw = JSON.stringify({ type: "email.delivered", data: {} })
			const timestamp = String(Math.floor(Date.now() / 1000))
			const secret = env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, "")
			const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`${eventId}.${timestamp}.${raw}`).digest("base64")
			const headers = { "content-type": "application/json", "svix-id": eventId, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` }
			assert.equal((await request("/api/v1/webhooks/resend", { method: "POST", headers, body: raw })).status, 200)
			assert.equal(await prisma.providerWebhookEvent.count({ where: { eventId } }), 1)
			assert.equal((await request("/api/v1/webhooks/resend", { method: "POST", headers, body: `${raw} ` })).status, 401)
			assert.equal((await request("/api/v1/webhooks/resend", { method: "POST", headers: { "content-type": "application/json" }, body: raw })).status, 401)
			for (const [suffix, method] of [["", "GET"], ["/checkout", "POST"], ["/checkout/verify", "POST"], ["/reconcile", "POST"], ["/cancel", "POST"]] as const) {
				assert.equal((await request(`/api/v1/workspaces/${workspace.id}/billing${suffix}`, { method })).status, 401)
			}
		})

		await t.test("refresh retries serialization conflicts without committing abandoned rotations", async () => {
			const source = await createSession()
			const transaction = prisma.$transaction
			const runTransaction = transaction.bind(prisma)
			let attempts = 0
			prisma.$transaction = (async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<unknown> => runTransaction(async (tx) => {
				const result = await callback(tx)
				if (++attempts === 1) throw new Prisma.PrismaClientKnownRequestError("Injected serialization conflict", { code: "P2034", clientVersion: Prisma.prismaVersion.client })
				if (attempts === 2) throw new Error("Injected commit conflict", { cause: { originalCode: "40001", kind: "TransactionWriteConflict" } })
				return result
			}, options)) as typeof prisma.$transaction
			try {
				const response = await request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: `refreshToken=${source.token}` } })
				assert.equal(response.status, 200)
				assert.equal(attempts, 3)
				const cookie = response.headers.get("set-cookie")
				assert.ok(cookie && !cookie.includes("refreshToken=;"))
				assert.notEqual((await prisma.refreshToken.findUniqueOrThrow({ where: { id: source.id } })).revokedAt, null)
				assert.equal(await prisma.refreshToken.count({ where: { sessionId: source.session.id } }), 2)
				assert.equal(await prisma.refreshToken.count({ where: { sessionId: source.session.id, revokedAt: null } }), 1)
				assert.equal((await request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: cookie.split(";")[0]! } })).status, 200)
			} finally { prisma.$transaction = transaction }
		})

		await t.test("exhausted refresh conflicts preserve the cookie and the original credential", async () => {
			const source = await createSession()
			const transaction = prisma.$transaction
			const runTransaction = transaction.bind(prisma)
			let attempts = 0
			prisma.$transaction = (async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<unknown> => runTransaction(async (tx) => {
				await callback(tx)
				attempts++
				throw new Prisma.PrismaClientKnownRequestError("Injected serialization conflict", { code: "P2034", clientVersion: Prisma.prismaVersion.client })
			}, options)) as typeof prisma.$transaction
			try {
				const response = await request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: `refreshToken=${source.token}` } })
				assert.equal(response.status, 503)
				assert.equal(response.headers.get("set-cookie"), null)
				assert.equal(attempts, 3)
				assert.equal((await prisma.refreshToken.findUniqueOrThrow({ where: { id: source.id } })).revokedAt, null)
				assert.equal(await prisma.refreshToken.count({ where: { sessionId: source.session.id } }), 1)
			} finally { prisma.$transaction = transaction }
			assert.equal((await request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: `refreshToken=${source.token}` } })).status, 200)
		})

		await t.test("independent sessions can refresh together and invalid credentials still clear cookies", async () => {
			const sessions = await Promise.all([createSession(), createSession()])
			const responses = await Promise.all(sessions.map((source) => request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: `refreshToken=${source.token}` } })))
			for (const response of responses) assert.equal(response.status, 200)
			for (const source of sessions) assert.equal(await prisma.refreshToken.count({ where: { sessionId: source.session.id, revokedAt: null } }), 1)
			const invalid = await request("/api/v1/auth/refresh", { method: "POST", headers: { origin: env.CLIENT_URL, cookie: "refreshToken=invalid" } })
			assert.equal(invalid.status, 401)
			assert.ok(invalid.headers.get("set-cookie")?.includes("refreshToken=;"))
		})

		const analyticsSession = await createSession()
		const accessToken = await generateAccessToken({ sub: user.id, sessionId: analyticsSession.session.id, workspaceId: workspace.id })
		const analyticsHeaders = { authorization: `Bearer ${accessToken}` }
		const delivery = await prisma.delivery.findFirstOrThrow({ where: { workspaceId: workspace.id }, include: { notification: true } })
		// A persisted synthetic attempt makes response type checks non-vacuous; no worker runs.
		await prisma.deliveryAttempt.create({ data: { deliveryId: delivery.id, notificationId: delivery.notificationId, channel: "IN_APP", attemptNumber: 1, status: "SUCCESS", startedAt: new Date(Date.now() - 1_000), finishedAt: new Date(), durationMs: 25 } })
		const dates = new URLSearchParams({ from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date(Date.now() + 1_000).toISOString(), granularity: "hour", limit: "1", ignored: "value" })
		for (const endpoint of ["overview", "delivery-timeline", "channel-breakdown", "top-templates"] as const) {
			await t.test(`analytics ${endpoint} accepts defaults and parsed range queries`, async () => {
				const path = `/api/v1/workspaces/${workspace.id}/analytics/${endpoint}`
				assert.equal((await request(`${path}?limit=0`, { headers: analyticsHeaders })).status, 400)
				for (const query of ["", "?timeRange=7d&limit=1", `?${dates}`]) {
					const response = await fetch(`${origin}${path}${query}`, { headers: analyticsHeaders })
					assert.equal(response.status, 200)
					const { data } = await response.json() as { data: unknown }
					if (endpoint === "overview") {
						assert.ok(data && typeof data === "object" && !Array.isArray(data))
						const overview = data as Record<string, unknown>
						for (const field of ["totalSent", "delivered", "failed", "deliveryRate", "openRate", "clickRate"]) assert.equal(typeof overview[field], "number")
						assert.equal(overview.totalSent, 1)
						assert.equal(overview.delivered, 1)
						assert.deepEqual(overview.byChannel, { IN_APP: { sent: 1, delivered: 1, failed: 0, deliveryRate: 1 } })
					} else {
						assert.ok(Array.isArray(data))
						assert.equal(data.length, 1)
						const row = data[0] as Record<string, unknown>
						assert.equal(row.sent, 1)
						assert.equal(row.delivered, 1)
						if (endpoint === "delivery-timeline") {
							assert.equal(typeof row.timestamp, "string")
							assert.ok(Number.isFinite(Date.parse(row.timestamp as string)))
							assert.equal(row.failed, 0)
						} else if (endpoint === "channel-breakdown") {
							assert.equal(row.channel, "IN_APP")
							assert.equal(row.failed, 0)
							assert.equal(row.avgDurationMs, 25)
						} else {
							assert.equal(row.templateId, delivery.notification.templateId)
							assert.equal(typeof row.name, "string")
							assert.equal(row.openRate, 0)
						}
					}
				}
			})
		}

		await t.test("GET email verification validates the query and consumes its token", async () => {
			await prisma.user.update({ where: { id: user.id }, data: { emailVerified: false } })
			const token = randomUUID()
			const verification = await prisma.emailVerification.create({ data: { userId: user.id, tokenHash: hashEmailToken(token), expiresAt: new Date(Date.now() + 60_000) } })
			assert.equal((await request("/api/v1/auth/verify-email", { headers: { accept: "application/json" } })).status, 400)
			assert.equal((await request(`/api/v1/auth/verify-email?token=${token}&ignored=value`, { headers: { accept: "application/json" } })).status, 200)
			assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified, true)
			assert.notEqual((await prisma.emailVerification.findUniqueOrThrow({ where: { id: verification.id } })).usedAt, null)
		})

		for (const state of ["logged-out", "rotated", "password-reset", "session-revoked", "expired", "missing", "wrong-hash", "active"] as const) {
			await t.test(`logout-all requires a stored active refresh token: ${state}`, async () => {
				const source = await createSession()
				if (state === "logged-out") await authService.logout(source.token)
				if (state === "rotated") await authService.refresh(source.token)
				if (state === "password-reset") {
					const resetToken = randomUUID()
					await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashEmailToken(resetToken), expiresAt: new Date(Date.now() + 60_000) } })
					await authService.resetPassword(resetToken, "Synthetic-reset-password-2026!")
				}
				if (state === "session-revoked") await authRepository.revokeSession(source.session.id)
				if (state === "expired") await prisma.refreshToken.update({ where: { id: source.id }, data: { expiresAt: new Date(Date.now() - 1_000) } })
				if (state === "missing") await prisma.refreshToken.delete({ where: { id: source.id } })
				if (state === "wrong-hash") await prisma.refreshToken.update({ where: { id: source.id }, data: { tokenHash: hashToken("another-token") } })
				const fresh = await createSession()
				const response = await request("/api/v1/auth/logout-all", {
					method: "POST",
					headers: { origin: env.CLIENT_URL, cookie: `refreshToken=${source.token}`, "content-type": "application/json" },
					// Separate limiter buckets keep these independent auth scenarios bounded.
					body: JSON.stringify({ email: `${state}-${marker}@example.test` }),
				})
				assert.equal(response.status, state === "active" ? 200 : 401)
				assert.ok(response.headers.get("set-cookie")?.includes("refreshToken=;"))
				const survivingSession = await prisma.session.findUniqueOrThrow({ where: { id: fresh.session.id } })
				const survivingToken = await prisma.refreshToken.findUniqueOrThrow({ where: { id: fresh.id } })
				assert.equal(Boolean(survivingSession.revokedAt), state === "active")
				assert.equal(Boolean(survivingToken.revokedAt), state === "active")
				if (state !== "active") await authService.refresh(fresh.token)
			})
		}
	} finally {
		server.closeAllConnections()
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
		await prisma.providerWebhookEvent.deleteMany({ where: { eventId } })
		await prisma.workspace.deleteMany({ where: { id: { in: [workspace.id, otherWorkspace.id] } } })
		await prisma.billingAccount.deleteMany({ where: { ownerUserId: user.id } })
		await prisma.user.delete({ where: { id: user.id } })
		for (const state of ["logged-out", "rotated", "password-reset", "session-revoked", "expired", "missing", "wrong-hash", "active"]) {
			await redis.del(`rl_auth:127.0.0.1_${state}-${marker}@example.test`)
		}
		await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
	}
})
