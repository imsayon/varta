import { prisma } from "@/infra/database/prisma.ts"
import argon2 from "argon2"
import crypto from "node:crypto"

export const apiKeyService = {
	async create(workspaceId: string, name: string, permissions?: any) {
		const rawKey = crypto.randomBytes(32).toString("hex")
		const prefix = "vt_live_" + crypto.randomBytes(4).toString("hex")
		const fullKey = prefix + "_" + rawKey
		const keyHash = await argon2.hash(fullKey)

		const apiKey = await prisma.apiKey.create({
			data: { workspaceId, name, prefix, keyHash, permissions },
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
			where: { prefix, isActive: true },
		})
		if (!apiKey) return null

		const isValid = await argon2.verify(apiKey.keyHash, rawKey)
		if (!isValid) return null

		// Fire-and-forget timestamp update — not worth blocking the request
		prisma.apiKey
			.update({
				where: { id: apiKey.id },
				data: { lastUsedAt: new Date() },
			})
			.catch(() => {})

		return apiKey
	},

	async revoke(workspaceId: string, keyId: string) {
		return prisma.apiKey.delete({
			where: { id: keyId, workspaceId },
		})
	},
}
