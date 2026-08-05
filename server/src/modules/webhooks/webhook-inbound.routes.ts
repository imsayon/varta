import { Router } from "express"
import { handleResendInboundWebhook } from "./webhook-inbound.controller.ts"

const router = Router()

router.post("/resend", handleResendInboundWebhook)

export const webhookInboundRoutes = router
