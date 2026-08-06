import { prisma } from "@/infra/database/prisma.ts"

const LEASE_MS = 30_000

export async function claimOutboxIntents(owner: string, limit = 50) {
	const now = new Date()
	const leaseUntil = new Date(now.getTime() + LEASE_MS)
	return prisma.$transaction(async (tx) => {
		const candidates = await tx.outboxIntent.findMany({
			where: {
				availableAt: { lte: now },
				OR: [
					{ status: { in: ["PENDING", "FAILED"] } },
					{ status: "LEASED", leaseUntil: { lt: now } },
				],
			},
			orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
			take: limit,
			select: { id: true },
		})
		const claimedIds: string[] = []
		for (const candidate of candidates) {
			const claimed = await tx.outboxIntent.updateMany({
				where: {
					id: candidate.id,
					availableAt: { lte: now },
					OR: [
						{ status: { in: ["PENDING", "FAILED"] } },
						{ status: "LEASED", leaseUntil: { lt: now } },
					],
				},
				data: { status: "LEASED", leaseOwner: owner, leaseUntil },
			})
			if (claimed.count === 1) claimedIds.push(candidate.id)
		}
		return tx.outboxIntent.findMany({
			where: { id: { in: claimedIds }, leaseOwner: owner, status: "LEASED" },
			include: { delivery: true },
		})
	})
}
