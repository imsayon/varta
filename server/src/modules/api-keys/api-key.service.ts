import { prisma } from "@/infra/database/prisma.ts"
import crypto from "node:crypto"
import { NotFoundError } from "@/common/errors/app-error.ts"
import { hashToken, verifyToken } from "@/common/utils/auth/token-hash.ts"
import argon2 from "argon2"
import { logger } from "@/infra/observability/logger.ts"

export const apiKeyService = {
	async create(
		workspaceId: string,
		name: string,
		permissions: string[],
		expiresAt?: Date,
	) {
		const rawKey = crypto.randomBytes(32).toString("hex")
		const prefix = "vt_live_" + crypto.randomBytes(4).toString("hex")
		const fullKey = prefix + "_" + rawKey
		const keyHash = hashToken(fullKey)

		const apiKey = await prisma.apiKey.create({
			data: {
				workspaceId,
				name,
				prefix,
				keyHash,
				permissions,
				...(expiresAt ? { expiresAt } : {}),
			},
			select: {
				id: true,
				name: true,
				prefix: true,
				permissions: true,
				isActive: true,
				expiresAt: true,
				createdAt: true,
			},
		})

		return { ...apiKey, fullKey }
	},

	async list(workspaceId: string) {
		return prisma.apiKey.findMany({
			where: { workspaceId },
			select: {
				id: true,
				name: true,
				prefix: true,
				isActive: true,
				createdAt: true,
				lastUsedAt: true,
				expiresAt: true,
			},
		})
	},

	async verify(rawKey: string) {
		const prefix = rawKey.split("_").slice(0, 3).join("_")

		const apiKey = await prisma.apiKey.findFirst({
			where: {
				prefix,
				isActive: true,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		})
		if (!apiKey) return null

		const isValid =
			verifyToken(rawKey, apiKey.keyHash) ||
			(await argon2.verify(apiKey.keyHash, rawKey).catch(() => false))

		if (!isValid) return null

		await prisma.apiKey
			.update({
				where: { id: apiKey.id },
				data: { lastUsedAt: new Date() },
			})
			.catch((error) => logger.warn({ err: error }, "API key last-used update failed"))

		return apiKey
	},

	async revoke(workspaceId: string, keyId: string) {
		const apiKey = await prisma.apiKey.findFirst({
			where: { id: keyId, workspaceId },
			select: { id: true },
		})

		if (!apiKey) {
			throw new NotFoundError("API key not found")
		}

		return prisma.apiKey.update({
			where: { id: apiKey.id },
			data: { isActive: false },
		})
	},
}
