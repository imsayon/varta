import { z } from "zod"

export const API_KEY_SCOPES = [
	"notifications:trigger",
	"notifications:retry",
	"subscribers:read",
	"subscribers:write",
	"subscribers:ws-token",
	"*",
] as const

export const createApiKeySchema = z.object({
	name: z.string().min(2).max(50),
	permissions: z.array(z.enum(API_KEY_SCOPES)).max(API_KEY_SCOPES.length).default([]),
	expiresAt: z.iso.datetime().optional(),
})
