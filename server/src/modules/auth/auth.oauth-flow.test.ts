import assert from "node:assert/strict"
import test from "node:test"
import type { NextFunction, Request, Response } from "express"
import { env } from "@/common/config/env.ts"
import { ConflictError } from "@/common/errors/app-error.ts"
import { disconnectRedis } from "@/infra/redis/redis.connection.ts"
import { authRepository } from "./auth.repository.ts"
import { authService } from "./auth.service.ts"
import {
	completeOAuth,
	createOAuthState,
	startOAuth,
	verifyOAuthStateSignature,
} from "./auth.oauth-flow.ts"

test("OAuth state is signed, unique, and rejects tampering", () => {
	const first = createOAuthState()
	const second = createOAuthState()

	assert.notEqual(first.state, second.state)
	assert.notEqual(first.codeVerifier, second.codeVerifier)
	assert.equal(first.codeVerifier.length >= 43, true)
	assert.equal(first.codeChallenge.length, 43)
	assert.equal(verifyOAuthStateSignature(first.state), true)
	assert.equal(verifyOAuthStateSignature(`${first.state}x`), false)
	assert.equal(verifyOAuthStateSignature(first.state.replace(".", "..")), false)
})

test("OAuth login returns an already linked provider identity", async (t) => {
	const user = { id: "user-1", email: "owner@example.com" }
	const findOauth = t.mock.method(authRepository, "findOauthAccount", async () => ({ user }))
	const findEmail = t.mock.method(authRepository, "findUserByEmail")
	const create = t.mock.method(authRepository, "createOAuthRegistration")

	const result = await authService.handleOAuthLogin({
		provider: "github",
		providerUid: "42",
		email: "owner@example.com",
		name: "Owner",
	})

	assert.equal(result, user)
	assert.equal(findOauth.mock.callCount(), 1)
	assert.equal(findEmail.mock.callCount(), 0)
	assert.equal(create.mock.callCount(), 0)
})

test("OAuth login refuses implicit email-based account linking", async (t) => {
	t.mock.method(authRepository, "findOauthAccount", async () => null)
	t.mock.method(authRepository, "findUserByEmail", async () => ({ id: "existing" }))
	const create = t.mock.method(authRepository, "createOAuthRegistration")

	await assert.rejects(
		authService.handleOAuthLogin({
			provider: "google",
			providerUid: "google-subject",
			email: "existing@example.com",
			name: "Existing",
		}),
		ConflictError,
	)
	assert.equal(create.mock.callCount(), 0)
})

test("OAuth registration persists identity fields without provider tokens", async (t) => {
	t.mock.method(authRepository, "findOauthAccount", async () => null)
	t.mock.method(authRepository, "findUserByEmail", async () => null)
	const created = { id: "new-user", email: "new@example.com" }
	const create = t.mock.method(authRepository, "createOAuthRegistration", async () => created)

	const result = await authService.handleOAuthLogin({
		provider: "github",
		providerUid: "84",
		email: "new@example.com",
		name: "New User",
	})

	assert.equal(result, created)
	assert.equal(create.mock.callCount(), 1)
	const payload = create.mock.calls[0]?.arguments[0]
	assert.equal(payload?.provider, "github")
	assert.equal(payload?.providerUid, "84")
	assert.equal("accessToken" in (payload ?? {}), false)
	assert.equal("refreshToken" in (payload ?? {}), false)
})

test("Google OAuth uses browser-bound one-time state, PKCE, and a cookie-only application session", async (t) => {
	t.after(async () => disconnectRedis())
	const originalConfig = {
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
		callbackUrl: env.GOOGLE_CALLBACK_URL,
	}
	Object.assign(env, {
		GOOGLE_CLIENT_ID: "google-client",
		GOOGLE_CLIENT_SECRET: "google-secret",
		GOOGLE_CALLBACK_URL: "http://localhost:5000/api/v1/auth/oauth/google/callback",
	})
	t.after(() => Object.assign(env, {
		GOOGLE_CLIENT_ID: originalConfig.clientId,
		GOOGLE_CLIENT_SECRET: originalConfig.clientSecret,
		GOOGLE_CALLBACK_URL: originalConfig.callbackUrl,
	}))

	const cookies = new Map<string, string>()
	let authorizationRedirect = ""
	const startResponse = {
		cookie: (name: string, value: string) => { cookies.set(name, value) },
		redirect: (_status: number, location: string) => { authorizationRedirect = location },
	} as unknown as Response
	let startError: unknown
	await startOAuth(
		"google",
		{ query: { returnTo: "/settings?tab=profile" } } as unknown as Request,
		startResponse,
		((error?: unknown) => { startError = error }) as NextFunction,
	)
	assert.equal(startError, undefined)
	const authorization = new URL(authorizationRedirect)
	const state = authorization.searchParams.get("state")
	assert.equal(authorization.origin, "https://accounts.google.com")
	assert.equal(authorization.searchParams.get("scope"), "openid email profile")
	assert.equal(authorization.searchParams.get("code_challenge_method"), "S256")
	assert.equal(typeof state, "string")
	assert.equal(cookies.get("varta_oauth_state"), state)

	const fetchMock = t.mock.method(globalThis, "fetch", async (input: Parameters<typeof fetch>[0]) => {
		const url = String(input)
		if (url === "https://oauth2.googleapis.com/token") {
			return new Response(JSON.stringify({ access_token: "transient-provider-token" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		assert.equal(url, "https://openidconnect.googleapis.com/v1/userinfo")
		return new Response(JSON.stringify({
			sub: "google-subject",
			email: "Owner@Example.com",
			email_verified: true,
			name: "Owner",
		}), { status: 200, headers: { "content-type": "application/json" } })
	})
	const user = { id: "oauth-user", email: "owner@example.com" }
	t.mock.method(authRepository, "findOauthAccount", async () => ({ user }))
	t.mock.method(authRepository, "createSession", async () => ({ id: "oauth-session" }))
	t.mock.method(authRepository, "findPrimaryWorkspaceForUser", async () => ({ workspaceId: "oauth-workspace" }))
	const refreshRecord = t.mock.method(authRepository, "createRefreshToken", async (
		data: Parameters<typeof authRepository.createRefreshToken>[0],
	) => data)

	let callbackRedirect = ""
	const callbackResponse = {
		cookie: (name: string, value: string) => { cookies.set(name, value) },
		clearCookie: (name: string) => { cookies.delete(name) },
		redirect: (_status: number, location: string) => { callbackRedirect = location },
	} as unknown as Response
	await completeOAuth("google", {
		query: { state, code: "authorization-code" },
		cookies: { varta_oauth_state: state },
		headers: { "user-agent": "test" },
		ip: "127.0.0.1",
	} as unknown as Request, callbackResponse)

	assert.equal(fetchMock.mock.callCount(), 2)
	assert.equal(refreshRecord.mock.callCount(), 1)
	assert.equal(cookies.has("varta_oauth_state"), false)
	assert.equal(cookies.has("refreshToken"), true)
	const callback = new URL(callbackRedirect)
	assert.equal(callback.pathname, "/auth/callback")
	assert.equal(callback.searchParams.get("returnTo"), "/settings?tab=profile")
	assert.equal(callback.searchParams.has("accessToken"), false)

	await completeOAuth("google", {
		query: { state, code: "replayed-code" },
		cookies: { varta_oauth_state: state },
		headers: {},
	} as unknown as Request, callbackResponse)
	assert.equal(new URL(callbackRedirect).searchParams.get("error"), "invalid_state")
})
