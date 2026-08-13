import crypto from "node:crypto"
import type { NextFunction, Request, Response } from "express"
import { env } from "@/common/config/env.ts"
import { BadRequestError, ConflictError, ServiceUnavailableError, UnauthorizedError } from "@/common/errors/app-error.ts"
import { connectRedis, redis } from "@/infra/redis/redis.connection.ts"
import { authService } from "./auth.service.ts"
import { authOauth } from "./auth.oauth.ts"

export type OAuthProvider = "google" | "github"

type OAuthStateRecord = {
	provider: OAuthProvider
	codeVerifier: string
	returnTo: string
}

type OAuthIdentity = {
	providerUid: string
	email: string
	name: string
}

const OAUTH_STATE_COOKIE = "varta_oauth_state"
const OAUTH_STATE_TTL_SECONDS = 600
const OAUTH_REQUEST_TIMEOUT_MS = 10_000

function providerConfig(provider: OAuthProvider) {
	const config = provider === "google"
		? {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			callbackUrl: env.GOOGLE_CALLBACK_URL,
		}
		: {
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			callbackUrl: env.GITHUB_CALLBACK_URL,
		}
	if (!config.clientId || !config.clientSecret || !config.callbackUrl) {
		throw new ServiceUnavailableError(`${provider} OAuth is not configured`)
	}
	return config
}

function base64UrlSha256(value: string): string {
	return crypto.createHash("sha256").update(value).digest("base64url")
}

function stateSignature(nonce: string): string {
	return crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(nonce).digest("base64url")
}

export function createOAuthState(): { state: string; codeVerifier: string; codeChallenge: string } {
	const nonce = crypto.randomBytes(32).toString("base64url")
	const codeVerifier = crypto.randomBytes(64).toString("base64url")
	return {
		state: `${nonce}.${stateSignature(nonce)}`,
		codeVerifier,
		codeChallenge: base64UrlSha256(codeVerifier),
	}
}

export function verifyOAuthStateSignature(state: string): boolean {
	const [nonce, suppliedSignature, ...extra] = state.split(".")
	if (!nonce || !suppliedSignature || extra.length > 0) return false
	const expectedSignature = stateSignature(nonce)
	const supplied = Buffer.from(suppliedSignature)
	const expected = Buffer.from(expectedSignature)
	return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
}

function stateKey(state: string): string {
	return `oauth:state:${base64UrlSha256(state)}`
}

function safeReturnTo(value: unknown): string {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/analytics"
	try {
		const parsed = new URL(value, env.CLIENT_URL)
		return parsed.origin === new URL(env.CLIENT_URL).origin
			? `${parsed.pathname}${parsed.search}${parsed.hash}`
			: "/analytics"
	} catch {
		return "/analytics"
	}
}

function authorizationUrl(
	provider: OAuthProvider,
	config: ReturnType<typeof providerConfig>,
	state: string,
	codeChallenge: string,
): string {
	const url = new URL(provider === "google"
		? "https://accounts.google.com/o/oauth2/v2/auth"
		: "https://github.com/login/oauth/authorize")
	url.searchParams.set("client_id", config.clientId)
	url.searchParams.set("redirect_uri", config.callbackUrl)
	url.searchParams.set("response_type", "code")
	url.searchParams.set("state", state)
	url.searchParams.set("code_challenge", codeChallenge)
	url.searchParams.set("code_challenge_method", "S256")
	url.searchParams.set("scope", provider === "google" ? "openid email profile" : "user:email")
	if (provider === "google") {
		url.searchParams.set("access_type", "online")
		url.searchParams.set("prompt", "select_account")
	}
	return url.toString()
}

export async function startOAuth(
	provider: OAuthProvider,
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	try {
		const config = providerConfig(provider)
		const { state, codeVerifier, codeChallenge } = createOAuthState()
		const record: OAuthStateRecord = {
			provider,
			codeVerifier,
			returnTo: safeReturnTo(req.query.returnTo),
		}
		await connectRedis()
		const stored = await redis.set(stateKey(state), JSON.stringify(record), {
			EX: OAUTH_STATE_TTL_SECONDS,
			NX: true,
		})
		if (stored !== "OK") throw new ServiceUnavailableError("Unable to initialize OAuth sign-in")
		res.cookie(OAUTH_STATE_COOKIE, state, {
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/api/v1/auth/oauth",
			maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
		})
		res.redirect(303, authorizationUrl(provider, config, state, codeChallenge))
	} catch (error) {
		next(error)
	}
}

async function exchangeCode(provider: OAuthProvider, code: string, verifier: string): Promise<string> {
	const config = providerConfig(provider)
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		code,
		redirect_uri: config.callbackUrl,
		code_verifier: verifier,
		...(provider === "google" ? { grant_type: "authorization_code" } : {}),
	})
	const response = await fetch(provider === "google"
		? "https://oauth2.googleapis.com/token"
		: "https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
		},
		body,
		signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS),
	})
	if (!response.ok) throw new UnauthorizedError("OAuth code exchange failed")
	const payload = await response.json() as { access_token?: unknown; error?: unknown }
	if (typeof payload.access_token !== "string" || payload.error) {
		throw new UnauthorizedError("OAuth code exchange failed")
	}
	return payload.access_token
}

async function fetchJson(url: string, accessToken: string): Promise<unknown> {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			authorization: `Bearer ${accessToken}`,
			"user-agent": "Varta-Public-Beta",
			"x-github-api-version": "2022-11-28",
		},
		signal: AbortSignal.timeout(OAUTH_REQUEST_TIMEOUT_MS),
	})
	if (!response.ok) throw new UnauthorizedError("OAuth identity verification failed")
	return response.json()
}

async function verifiedIdentity(provider: OAuthProvider, accessToken: string): Promise<OAuthIdentity> {
	if (provider === "google") {
		const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", accessToken) as {
			sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown
		}
		if (typeof profile.sub !== "string" || typeof profile.email !== "string" || profile.email_verified !== true) {
			throw new UnauthorizedError("Google did not provide a verified email")
		}
		return {
			providerUid: profile.sub,
			email: profile.email.trim().toLowerCase(),
			name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : "Google User",
		}
	}

	const [profile, emails] = await Promise.all([
		fetchJson("https://api.github.com/user", accessToken) as Promise<{ id?: unknown; name?: unknown; login?: unknown }>,
		fetchJson("https://api.github.com/user/emails", accessToken) as Promise<Array<{ email?: unknown; primary?: unknown; verified?: unknown }>>,
	])
	const primary = Array.isArray(emails)
		? emails.find((entry) => entry.primary === true && entry.verified === true && typeof entry.email === "string")
			?? emails.find((entry) => entry.verified === true && typeof entry.email === "string")
		: undefined
	if ((typeof profile.id !== "number" && typeof profile.id !== "string") || typeof primary?.email !== "string") {
		throw new UnauthorizedError("GitHub did not provide a verified email")
	}
	const fallbackName = typeof profile.login === "string" ? profile.login : "GitHub User"
	return {
		providerUid: String(profile.id),
		email: primary.email.trim().toLowerCase(),
		name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : fallbackName,
	}
}

function callbackUrl(error: string | null, returnTo = "/analytics"): string {
	const url = new URL("/auth/callback", env.CLIENT_URL)
	if (error) url.searchParams.set("error", error)
	else url.searchParams.set("returnTo", safeReturnTo(returnTo))
	return url.toString()
}

export async function completeOAuth(
	provider: OAuthProvider,
	req: Request,
	res: Response,
): Promise<void> {
	const state = typeof req.query.state === "string" ? req.query.state : ""
	const code = typeof req.query.code === "string" ? req.query.code : ""
	const cookieState = req.cookies?.[OAUTH_STATE_COOKIE]
	res.clearCookie(OAUTH_STATE_COOKIE, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/api/v1/auth/oauth",
	})

	try {
		if (req.query.error || !state || !code) throw new BadRequestError("OAuth authorization was not completed")
		if (!verifyOAuthStateSignature(state) || typeof cookieState !== "string" || cookieState !== state) {
			throw new BadRequestError("Invalid OAuth state")
		}
		await connectRedis()
		const encoded = await redis.getDel(stateKey(state))
		if (!encoded) throw new BadRequestError("OAuth state expired or was already used")
		const record = JSON.parse(encoded) as OAuthStateRecord
		if (record.provider !== provider || typeof record.codeVerifier !== "string") {
			throw new BadRequestError("OAuth provider mismatch")
		}
		const accessToken = await exchangeCode(provider, code, record.codeVerifier)
		const identity = await verifiedIdentity(provider, accessToken)
		req.oauthUser = await authService.handleOAuthLogin({ provider, ...identity })
		await authOauth.handleOAuthCallback(req, res, record.returnTo)
	} catch (error) {
		const code = error instanceof ConflictError ? "account_collision"
			: error instanceof BadRequestError ? "invalid_state"
			: "oauth_failed"
		res.redirect(303, callbackUrl(code))
	}
}
