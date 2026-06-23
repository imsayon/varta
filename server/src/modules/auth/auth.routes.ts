import { Router } from "express"
import * as authController from "./auth.controller.ts"
import { validate } from "../../shared/middleware/validate.middleware.ts"
import { registerSchema, loginSchema } from "./auth.schema.ts"

const router = Router()

router.post("/register", validate(registerSchema), authController.register)
router.post("/login", validate(loginSchema), authController.login)
router.post("/refresh", authController.refresh)
router.post("/logout", authController.logout)
router.get("/me", authController.me)

export { router as authRouter }
