import { Router } from "express"
import { authController } from "./auth.controller.ts"
import { validate } from "@/shared/middleware/validate.middleware.ts"
import { authenticate } from "@/shared/middleware/auth.middleware.ts"
import {
	registerSchema,
	loginSchema,
	verifyEmailSchema,
	resendVerificationSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
} from "./auth.schema.ts"

import { rateLimitAuth } from "@/shared/middleware/rate-limit.middleware.ts"

const router = Router()

// public routes
router.post("/register", rateLimitAuth, validate(registerSchema), authController.register)
router.post("/login", rateLimitAuth, validate(loginSchema), authController.login)
router.post("/refresh", authController.refresh)
router.post("/logout", authController.logout)
router.post("/logout-all", authController.logoutAll)
router.get("/verify-email", validate(verifyEmailSchema, "query"), authController.verifyEmail)
router.post("/resend-verification", validate(resendVerificationSchema), authController.resendVerification)
router.post("/forgot-password", rateLimitAuth, validate(forgotPasswordSchema), authController.forgotPassword)
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword)

// protected routes
router.get("/me", authenticate, authController.me)
router.get("/sessions", authenticate, authController.getSessions)
router.delete("/sessions/:id", authenticate, authController.revokeSession)

import { passport } from "./auth.passport.ts"
import { authOauth } from "./auth.oauth.ts"

// OAuth Routes
router.get(
	"/oauth/google",
	passport.authenticate("google", { scope: ["profile", "email"], session: false })
)

router.get(
	"/oauth/google/callback",
	passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=google_failed` }),
	authOauth.handleOAuthCallback
)

router.get(
	"/oauth/github",
	passport.authenticate("github", { scope: ["user:email"], session: false })
)

router.get(
	"/oauth/github/callback",
	passport.authenticate("github", { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=github_failed` }),
	authOauth.handleOAuthCallback
)

export { router as authRouter }
