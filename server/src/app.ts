import express from "express"
import compression from "compression"
import cookieParser from "cookie-parser"
import cors from "cors"
import helmet from "helmet"
import pinoHttp from "pino-http"
import { env } from "./common/config/env.ts"
import { logger } from "@/infra/logger/logger.ts"
import { errorHandler } from "./common/middleware/error.middleware.ts"
import { notFoundHandler } from "./common/middleware/not-found.middleware.ts"
import { passport } from "@/modules/auth/auth.passport.ts"

// Module Routes
import { healthRouter } from "./modules/health/health.routes.ts"
import { authRouter } from "./modules/auth/auth.routes.ts"
import { workspaceRouter } from "./modules/workspaces/workspace.routes.ts"
import { subscriberRouter } from "./modules/subscribers/subscriber.routes.ts"
import { templateRouter } from "./modules/templates/template.routes.ts"
import { apiKeyRouter } from "./modules/api-keys/api-key.routes.ts"
import { notificationRouter } from "./modules/notifications/notification.routes.ts"
import { routingRuleRouter } from "./modules/routing-rules/routing-rule.routes.ts"
import { analyticsRouter } from "./modules/analytics/analytics.routes.ts"
import { providerRouter } from "./modules/providers/provider.routes.ts"

const app = express()

// Global Middleware
app.disable("x-powered-by")
// pino-http CJS interop: types lack call signature under verbatimModuleSyntax
app.use((pinoHttp as unknown as (opts: { logger: typeof logger }) => express.RequestHandler)({ logger }))
app.use(helmet())
app.use(compression())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: "1mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(passport.initialize())

// Route Mounting
app.use("/api/health", healthRouter)
app.use("/api/v1/auth", authRouter)
app.use("/api/v1/workspaces", workspaceRouter)
app.use("/api/v1/workspaces/:workspaceId/subscribers", subscriberRouter)
app.use("/api/v1/workspaces/:workspaceId/templates", templateRouter)
app.use("/api/v1/workspaces/:workspaceId/api-keys", apiKeyRouter)
app.use("/api/v1/workspaces/:workspaceId/notifications", notificationRouter)
app.use("/api/v1/workspaces/:workspaceId/routing-rules", routingRuleRouter)
app.use("/api/v1/workspaces/:workspaceId/analytics", analyticsRouter)
app.use("/api/v1/workspaces/:workspaceId/providers", providerRouter)

// Error Handling
app.use(notFoundHandler)
app.use(errorHandler)

export { app }
