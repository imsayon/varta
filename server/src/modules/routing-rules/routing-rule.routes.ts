import { Router } from "express"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	compileRoutingRuleSchema,
	createRoutingRuleSchema,
	updateRoutingRuleSchema,
} from "./routing-rule.schema.ts"
import * as controller from "./routing-rule.controller.ts"
import { authorize } from "@/common/auth/route-policy.ts"
const router = Router({ mergeParams: true })
router.post("/compile", authenticate, authorize("routing.compile"), validate(compileRoutingRuleSchema), controller.compile)
router.use(authenticate)
router.get("/", authorize("routing.list"), controller.list)
router.post("/", authorize("routing.create"), validate(createRoutingRuleSchema), controller.create)
router.patch("/:ruleId", authorize("routing.update"), validate(updateRoutingRuleSchema), controller.update)
router.delete("/:ruleId", authorize("routing.delete"), controller.remove)
export { router as routingRuleRouter }
