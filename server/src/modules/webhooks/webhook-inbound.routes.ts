import { Router } from "express"
import { handleResendInboundWebhook } from "./webhook-inbound.controller.ts"
import { authorize } from "@/common/auth/route-policy.ts"
import { authenticateProviderWebhook } from "@/common/middleware/provider-webhook.middleware.ts"

const router = Router()

router.post("/resend", authenticateProviderWebhook, authorize("webhook.provider.resend"), handleResendInboundWebhook)

export const webhookInboundRoutes = router
