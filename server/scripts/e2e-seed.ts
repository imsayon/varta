import { disconnectDatabase, prisma } from "../src/infra/database/prisma.ts"
import { hashPassword } from "../src/common/utils/auth/password.ts"

if (process.env.NODE_ENV !== "test") throw new Error("E2E seed is test-only")

const email = "e2e-owner@example.test"
await prisma.user.deleteMany({ where: { email } })
const passwordHash = await hashPassword("Varta-e2e-password-123!")
await prisma.user.create({
	data: {
		email,
		name: "E2E Owner",
		passwordHash,
		emailVerified: true,
		workspaceMembers: {
			create: {
				role: "OWNER",
				workspace: {
					create: {
						name: "E2E Workspace",
						slug: "e2e-workspace",
						subscribers: { create: { externalId: "e2e-subscriber", email: "recipient@example.test", name: "E2E Subscriber", preferences: { email: true, inapp: true, webhook: true } } },
						templates: { create: { name: "E2E Template", channels: { inapp: { title: "Hello {{name}}", body: "E2E delivery" } }, isActive: true } },
					},
				},
			},
		},
	},
})
await disconnectDatabase()
