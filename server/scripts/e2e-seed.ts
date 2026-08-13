import { disconnectDatabase, prisma } from "../src/infra/database/prisma.ts"
import { hashPassword } from "../src/common/utils/auth/password.ts"

if (process.env.NODE_ENV !== "test") throw new Error("E2E seed is test-only")

const passwordHash = await hashPassword("Varta-e2e-password-123!")
const variants = ["desktop", "narrow"] as const
const emails = variants.flatMap((variant) => [
	`e2e-owner-${variant}@example.test`,
	`e2e-member-${variant}@example.test`,
])
const legacyEmails = ["e2e-owner@example.test", "e2e-member@example.test"]
const existingUsers = await prisma.user.findMany({
	where: { email: { in: [...emails, ...legacyEmails] } },
	select: { id: true },
})
const existingUserIds = existingUsers.map(({ id }) => id)
if (existingUserIds.length > 0) {
	await prisma.workspace.deleteMany({
		where: { members: { some: { userId: { in: existingUserIds }, role: "OWNER" } } },
	})
	await prisma.billingAccount.deleteMany({ where: { ownerUserId: { in: existingUserIds } } })
	await prisma.user.deleteMany({ where: { id: { in: existingUserIds } } })
}

for (const variant of variants) {
	const owner = await prisma.user.create({
		data: {
			email: `e2e-owner-${variant}@example.test`,
			name: `E2E ${variant} Owner`,
			passwordHash,
			emailVerified: true,
			workspaceMembers: {
				create: {
					role: "OWNER",
					workspace: {
						create: {
							name: `E2E ${variant} Workspace`,
							slug: `e2e-${variant}-workspace`,
							subscribers: { create: { externalId: "e2e-subscriber", email: "recipient@example.test", name: "E2E Subscriber", preferences: { email: true, inapp: true, webhook: true } } },
							templates: { create: { name: "E2E Template", channels: { inapp: { title: "Hello {{name}}", body: "E2E delivery" } }, isActive: true } },
						},
					},
				},
			},
		},
		include: { workspaceMembers: true },
	})
	await prisma.user.create({
		data: {
			email: `e2e-member-${variant}@example.test`,
			name: `E2E ${variant} Member`,
			passwordHash,
			emailVerified: true,
			workspaceMembers: {
				create: { workspaceId: owner.workspaceMembers[0]!.workspaceId, role: "MEMBER" },
			},
		},
	})
}

await disconnectDatabase()
