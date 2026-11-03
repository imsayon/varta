import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { createOwnedTestWorkspace } from "@/testing/billing-test-fixture.ts"
import { decryptConfig } from "@/common/utils/crypto.util.ts"
import { generateAccessToken } from "@/common/utils/auth/jwt.ts"
import { disconnectDatabase, prisma } from "@/infra/database/prisma.ts"
import { providerService } from "./provider.service.ts"

test("email settings preserve omitted credentials, replace explicit credentials, and reject unauthorized writes", {
  skip: process.env.RUN_TENANT_DATABASE_TESTS !== "true", timeout: 30_000,
}, async () => {
  const [{ app }, { connectRedis, disconnectRedis }, { closeQueues }] = await Promise.all([
    import("@/app.ts"), import("@/infra/redis/redis.connection.ts"), import("@/infra/queues/queue.factory.ts"),
  ])
  await connectRedis()
  const fixture = await createOwnedTestWorkspace("Provider persistence")
  const other = await createOwnedTestWorkspace("Other provider tenant")
  const server = app.listen(0, "127.0.0.1")
  await new Promise<void>(resolve => server.once("listening", resolve))
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const token = await generateAccessToken({ sub: fixture.user.id, sessionId: randomUUID(), workspaceId: fixture.workspace.id })
  const origin = `http://127.0.0.1:${address.port}/api/v1/workspaces`
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  const url = `${origin}/${fixture.workspace.id}/providers`
  const readStored = async () => {
    const row = await providerService.getProviderConfig(fixture.workspace.id, "email")
    assert.ok(row)
    return decryptConfig(row.config as Record<string, unknown>)
  }
  const put = (config: Record<string, unknown>) => fetch(`${url}/email`, { method: "PUT", headers, body: JSON.stringify({ provider: "resend", config, isActive: true }) })
  try {
    const original = "synthetic-provider-original-never-sent"
    assert.equal((await put({ apiKey: original, fromAddress: "fixture@example.test" })).status, 200)
    const listed = await fetch(url, { headers })
    assert.equal(listed.status, 200)
    const listedBody = await listed.json() as { data: Array<{ config: Record<string, unknown> }> }
    assert.equal(listedBody.data[0]?.config.apiKey, "********")
    assert.equal(JSON.stringify(listedBody).includes(original), false)
    const workspaceSave = await fetch(`${origin}/${fixture.workspace.id}`, { method: "PATCH", headers,
      body: JSON.stringify({ name: fixture.workspace.name, settings: { defaultTimezone: "Europe/London" } }) })
    assert.equal(workspaceSave.status, 200)
    assert.equal((await put({ fromAddress: "fixture@example.test" })).status, 200)
    assert.equal((await readStored()).apiKey, original, "ordinary configuration save must preserve the stored API key")
    assert.equal((await put({ apiKey: "synthetic-provider-replacement", fromAddress: "replacement@example.test" })).status, 200)
    assert.deepEqual(await readStored(), { apiKey: "synthetic-provider-replacement", fromAddress: "replacement@example.test" })
    assert.equal((await put({ apiKey: "********", fromAddress: "replacement@example.test" })).status, 400)
    assert.equal((await readStored()).apiKey, "synthetic-provider-replacement")
    assert.equal((await fetch(`${url}/email`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "resend", config: { apiKey: "unauthorized" } }) })).status, 401)
    assert.equal((await fetch(`${origin}/${other.workspace.id}/providers/email`, { method: "PUT", headers, body: JSON.stringify({ provider: "resend", config: { apiKey: "unauthorized" } }) })).status, 404)
    await prisma.workspaceMember.create({ data: { workspaceId: fixture.workspace.id, userId: other.user.id, role: "MEMBER" } })
    const memberToken = await generateAccessToken({ sub: other.user.id, sessionId: randomUUID(), workspaceId: fixture.workspace.id })
    assert.equal((await fetch(`${url}/email`, { method: "PUT", headers: { ...headers, Authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ provider: "resend", config: { apiKey: "unauthorized" } }) })).status, 403)
    assert.equal((await readStored()).apiKey, "synthetic-provider-replacement")
    assert.equal(await providerService.getProviderConfig(other.workspace.id, "email"), null)
    const otherToken = await generateAccessToken({ sub: other.user.id, sessionId: randomUUID(), workspaceId: other.workspace.id })
    assert.equal((await fetch(`${origin}/${other.workspace.id}/providers/email`, { method: "PUT", headers: { ...headers, Authorization: `Bearer ${otherToken}` }, body: JSON.stringify({ provider: "resend", config: { fromAddress: "missing@example.test" } }) })).status, 400)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await Promise.all([fixture.cleanup(), other.cleanup()])
    await Promise.allSettled([closeQueues(), disconnectRedis(), disconnectDatabase()])
  }
})
