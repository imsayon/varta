import { Router } from "express"
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
import { authorize } from "@/common/auth/route-policy.ts"
import { requireTrustedOrigin } from "@/common/utils/auth/cookies.ts"
import { completeOAuth, startOAuth } from "./auth.oauth-flow.ts"

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
router.post("/refresh", authorize("auth.refresh"), requireTrustedOrigin, authController.refresh)
router.post("/logout", authorize("auth.logout"), requireTrustedOrigin, rateLimitAuth, authController.logout)
router.post("/logout-all", authorize("auth.logoutAll"), requireTrustedOrigin, rateLimitAuth, authController.logoutAll)
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
	rateLimitAuth,
	validate(resetPasswordSchema),
	authController.resetPassword,
)

// Protected routes
router.get("/me", authenticate, authorize("auth.me"), authController.me)
router.get("/sessions", authenticate, authorize("auth.sessions.list"), authController.getSessions)
router.delete("/sessions/:id", authenticate, authorize("auth.sessions.revoke"), authController.revokeSession)

router.get(
	"/oauth/google",
	authorize("auth.oauth.google.start"),
	(req, res, next) => void startOAuth("google", req, res, next),
)

router.get(
	"/oauth/google/callback",
	authorize("auth.oauth.google.callback"),
	(req, res) => void completeOAuth("google", req, res),
)

router.get(
	"/oauth/github",
	authorize("auth.oauth.github.start"),
	(req, res, next) => void startOAuth("github", req, res, next),
)

router.get(
	"/oauth/github/callback",
	authorize("auth.oauth.github.callback"),
	(req, res) => void completeOAuth("github", req, res),
)

export { router as authRouter }
