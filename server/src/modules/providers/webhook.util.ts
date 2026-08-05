import { createHmac, timingSafeEqual } from "node:crypto"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
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
		a === 0
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
		normalized.startsWith("feb")
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
