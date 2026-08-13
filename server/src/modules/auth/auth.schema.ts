import { z } from "zod"

const strongPasswordSchema = z
	.string()
	.min(8)
	.max(128)
	.regex(/[A-Z]/, "Must contain uppercase letter")
	.regex(/[a-z]/, "Must contain lowercase letter")
	.regex(/[0-9]/, "Must contain a number")

export const registerSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, "Name must be at least 2 characters.")
		.max(100),

	email: z.email().transform((email) => email.toLowerCase()),

	password: strongPasswordSchema,
})

export const loginSchema = z.object({
	email: z.email().transform((e) => e.toLowerCase()),
	password: z.string().min(1),
})

export const verifyEmailSchema = z.object({
	token: z.string().min(1),
})

export const resendVerificationSchema = z.object({
	email: z.email().transform((e) => e.toLowerCase()),
})

export const forgotPasswordSchema = z.object({
	email: z.email().transform((e) => e.toLowerCase()),
})

export const resetPasswordSchema = z.object({
	token: z.string().min(1),
	password: strongPasswordSchema.optional(),
	newPassword: strongPasswordSchema.optional(),
}).refine((data) => !!(data.password || data.newPassword), {
	message: "Password is required",
	path: ["password"],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
