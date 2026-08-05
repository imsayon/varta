import { Router } from "express"
import { env } from "@/common/config/env.ts"
import { authController } from "./auth.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import {
	registerSchema,
	loginSchema,
	verifyEmailSchema,
	resendVerificationSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
} from "./auth.schema.ts"

import { rateLimitAuth } from "@/common/middleware/rate-limit.middleware.ts"
import { passport } from "./auth.passport.ts"
import { authOauth } from "./auth.oauth.ts"

const router = Router()

// Public routes
router.post(
	"/register",
	rateLimitAuth,
	validate(registerSchema),
	authController.register,
)
router.post(
	"/login",
	rateLimitAuth,
	validate(loginSchema),
	authController.login,
)
router.post("/refresh", authController.refresh)
router.post("/logout", rateLimitAuth, authController.logout)
router.post("/logout-all", rateLimitAuth, authController.logoutAll)
router.get(
	"/verify-email",
	validate(verifyEmailSchema, "query"),
	authController.verifyEmail,
)
router.post(
	"/verify-email",
	validate(verifyEmailSchema),
	authController.verifyEmail,
)
router.post(
	"/resend-verification",
	rateLimitAuth,
	validate(resendVerificationSchema),
	authController.resendVerification,
)
router.post(
	"/forgot-password",
	rateLimitAuth,
	validate(forgotPasswordSchema),
	authController.forgotPassword,
)
router.post(
	"/reset-password",
	validate(resetPasswordSchema),
	authController.resetPassword,
)

// Protected routes
router.get("/me", authenticate, authController.me)
router.get("/sessions", authenticate, authController.getSessions)
router.delete("/sessions/:id", authenticate, authController.revokeSession)

// OAuth Routes
router.get(
	"/oauth/google",
	passport.authenticate("google", {
		scope: ["profile", "email"],
		session: false,
	}),
)

router.get(
	"/oauth/google/callback",
	passport.authenticate("google", {
		session: false,
		failureRedirect: `${env.CLIENT_URL}/login?error=google_failed`,
	}),
	authOauth.handleOAuthCallback,
)

router.get(
	"/oauth/github",
	passport.authenticate("github", { scope: ["user:email"], session: false }),
)

router.get(
	"/oauth/github/callback",
	passport.authenticate("github", {
		session: false,
		failureRedirect: `${env.CLIENT_URL}/login?error=github_failed`,
	}),
	authOauth.handleOAuthCallback,
)

export { router as authRouter }
