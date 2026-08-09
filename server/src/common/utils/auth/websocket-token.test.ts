import assert from "node:assert/strict"
import test from "node:test"
import { generateSubscriberWebSocketToken, generateWorkspaceWebSocketToken, verifyWebSocketToken } from "./websocket-token.ts"

test("subscriber and workspace WebSocket grants are short-lived and type-separated", async () => {
	const subscriber = await verifyWebSocketToken(await generateSubscriberWebSocketToken({ sub: "subscriber-1", workspaceId: "workspace-1" }))
	const workspace = await verifyWebSocketToken(await generateWorkspaceWebSocketToken({ sub: "user-1", workspaceId: "workspace-1" }))
	assert.equal(subscriber.type, "subscriber_ws")
	assert.equal(workspace.type, "workspace_ws")
	assert.ok((subscriber.exp ?? 0) - (subscriber.iat ?? 0) <= 300)
	assert.ok((workspace.exp ?? 0) - (workspace.iat ?? 0) <= 300)
})
