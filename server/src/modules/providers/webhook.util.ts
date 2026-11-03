import { createHmac, timingSafeEqual } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { request as httpRequest, type ClientRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { env } from "@/common/config/env.ts"

function isPrivateIpv4(ip: string): boolean {
	const octets = ip.split(".").map(Number)
	const [a, b] = octets
	if (a === undefined || b === undefined) return false
	return (
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 192 && b === 0) ||
		(a === 192 && b === 2) ||
		(a === 198 && (b === 18 || b === 19 || b === 51)) ||
		(a === 203 && b === 0) ||
		a === 0 ||
		a >= 224
	)
}

function isPrivateIpv6(ip: string): boolean {
	const normalized = ip.toLowerCase()
	return (
		normalized === "::1" ||
		normalized === "::" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe8") ||
		normalized.startsWith("fe9") ||
		normalized.startsWith("fea") ||
		normalized.startsWith("feb") ||
		normalized.startsWith("ff") ||
		normalized.startsWith("2001:db8:") ||
		normalized.startsWith("::ffff:")
	)
}

export function isPrivateAddress(address: string): boolean {
	if (isIP(address) === 4) return isPrivateIpv4(address)
	if (isIP(address) === 6) return isPrivateIpv6(address)
	return false
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<{ url: URL; resolvedIp: string }> {
	let url: URL
	try {
		url = new URL(rawUrl)
	} catch {
		throw new Error("Webhook URL must be a valid URL")
	}

	if (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.protocol === "http:")) {
		throw new Error("Webhook URL must use HTTPS")
	}
	if (url.username || url.password) {
		throw new Error("Webhook URL must not contain credentials")
	}

	let resolvedIp = url.hostname
	if (env.NODE_ENV !== "test") {
		const addresses = isIP(url.hostname)
			? [{ address: url.hostname }]
			: await lookup(url.hostname, { all: true, verbatim: true })

		if (addresses.length === 0) {
			throw new Error("Webhook URL hostname could not be resolved")
		}

		if (addresses.some(({ address }) => isPrivateAddress(address))) {
			throw new Error("Webhook URL resolves to a private network address")
		}

		resolvedIp = addresses[0]?.address || url.hostname
	}

	return { url, resolvedIp }
}

export async function postSafeWebhook(
	rawUrl: string,
	body: string,
	headers: Record<string, string>,
	timeoutMs: number,
	maxResponseBytes: number,
): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		let req: ClientRequest | undefined
		let settled = false
		const fail = (error: Error) => {
			if (settled) return
			settled = true
			clearTimeout(deadline)
			req?.destroy()
			reject(error)
		}
		const deadline = setTimeout(() => fail(new Error("Webhook request timed out")), timeoutMs)
		void (async () => {
			const { url, resolvedIp } = await assertSafeWebhookUrl(rawUrl)
			// DNS cannot be cancelled; a late lookup must never start a request.
			if (settled) return
			const request = url.protocol === "https:" ? httpsRequest : httpRequest
			req = request(
				{
					protocol: url.protocol,
					host: resolvedIp,
					port: url.port || undefined,
					path: `${url.pathname}${url.search}`,
					method: "POST",
					agent: false,
					servername: url.protocol === "https:" ? url.hostname : undefined,
					rejectUnauthorized: true,
					headers: { ...headers, host: url.host, "content-length": Buffer.byteLength(body).toString() },
				},
				(response) => {
					const chunks: Buffer[] = []
					let received = 0
					response.on("error", fail)
					response.on("aborted", () => fail(Object.assign(
						new Error("Webhook response aborted"), { code: "ECONNRESET" },
					)))
					response.on("data", (chunk: Buffer) => {
						received += chunk.length
						if (received > maxResponseBytes) {
							fail(new Error("Webhook response exceeded size limit"))
							return
						}
						chunks.push(chunk)
					})
					response.on("end", () => {
						if (settled) return
						settled = true
						clearTimeout(deadline)
						resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })
					})
				},
			)
			req.on("error", fail)
			req.end(body)
		})().catch(fail)
	})
}

export function createWebhookSignature(
	timestamp: number,
	rawBody: string,
	secret: string,
): string {
	return createHmac("sha256", secret)
		.update(`${timestamp}.${rawBody}`)
		.digest("hex")
}

export function verifyWebhookSignature(
	timestamp: number,
	rawBody: string,
	secret: string,
	signature: string,
): boolean {
	const expected = createWebhookSignature(timestamp, rawBody, secret)
	const expectedBuffer = Buffer.from(expected, "utf8")
	const actualBuffer = Buffer.from(signature, "utf8")
	return (
		expectedBuffer.length === actualBuffer.length &&
		timingSafeEqual(expectedBuffer, actualBuffer)
	)
}

export function verifyResendWebhookSignature(
	eventId: string,
	timestamp: string,
	rawBody: string,
	secret: string,
	signatureHeader: string,
): boolean {
	if (!secret) return false
	let key: Buffer
	try {
		key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64")
	} catch {
		return false
	}
	if (key.length === 0) return false
	const expected = createHmac("sha256", key)
		.update(`${eventId}.${timestamp}.${rawBody}`)
		.digest()
	for (const token of signatureHeader.trim().split(/\s+/)) {
		const [version, encoded] = token.split(",", 2)
		if (version !== "v1" || !encoded) continue
		const actual = Buffer.from(encoded, "base64")
		if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
			return true
		}
	}
	return false
}
