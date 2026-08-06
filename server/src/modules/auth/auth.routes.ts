import { Router } from "express"
import { env } from "@/common/config/env.ts"
import { authController } from "./auth.controller.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import { authenticate, captureOAuthUser } from "@/common/middleware/auth.middleware.ts"
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
import { authorize } from "@/common/auth/route-policy.ts"

const router = Router()

// Public routes
router.post(
	"/register",
	authorize("auth.register"),
	rateLimitAuth,
	validate(registerSchema),
	authController.register,
)
router.post(
	"/login",
	authorize("auth.login"),
	rateLimitAuth,
	validate(loginSchema),
	authController.login,
)
router.post("/refresh", authorize("auth.refresh"), authController.refresh)
router.post("/logout", authorize("auth.logout"), rateLimitAuth, authController.logout)
router.post("/logout-all", authorize("auth.logoutAll"), rateLimitAuth, authController.logoutAll)
router.get(
	"/verify-email",
	authorize("auth.verifyEmail.get"),
	validate(verifyEmailSchema, "query"),
	authController.verifyEmail,
)
router.post(
	"/verify-email",
	authorize("auth.verifyEmail.post"),
	validate(verifyEmailSchema),
	authController.verifyEmail,
)
router.post(
	"/resend-verification",
	authorize("auth.resendVerification"),
	rateLimitAuth,
	validate(resendVerificationSchema),
	authController.resendVerification,
)
router.post(
	"/forgot-password",
	authorize("auth.forgotPassword"),
	rateLimitAuth,
	validate(forgotPasswordSchema),
	authController.forgotPassword,
)
router.post(
	"/reset-password",
	authorize("auth.resetPassword"),
	validate(resetPasswordSchema),
	authController.resetPassword,
)

// Protected routes
router.get("/me", authenticate, authorize("auth.me"), authController.me)
router.get("/sessions", authenticate, authorize("auth.sessions.list"), authController.getSessions)
router.delete("/sessions/:id", authenticate, authorize("auth.sessions.revoke"), authController.revokeSession)

// OAuth Routes
router.get(
	"/oauth/google",
	authorize("auth.oauth.google.start"),
	passport.authenticate("google", {
		scope: ["profile", "email"],
		session: false,
	}),
)

router.get(
	"/oauth/google/callback",
	authorize("auth.oauth.google.callback"),
	passport.authenticate("google", {
		session: false,
		failureRedirect: `${env.CLIENT_URL}/login?error=google_failed`,
	}),
	captureOAuthUser,
	authOauth.handleOAuthCallback,
)

router.get(
	"/oauth/github",
	authorize("auth.oauth.github.start"),
	passport.authenticate("github", { scope: ["user:email"], session: false }),
)

router.get(
	"/oauth/github/callback",
	authorize("auth.oauth.github.callback"),
	passport.authenticate("github", {
		session: false,
		failureRedirect: `${env.CLIENT_URL}/login?error=github_failed`,
	}),
	captureOAuthUser,
	authOauth.handleOAuthCallback,
)

export { router as authRouter }
