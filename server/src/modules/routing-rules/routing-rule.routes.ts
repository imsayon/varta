import { Router } from "express"
import { authenticate } from "@/common/middleware/auth.middleware.ts"
import { validate } from "@/common/middleware/validate.middleware.ts"
import {
	compileRoutingRuleSchema,
	createRoutingRuleSchema,
	updateRoutingRuleSchema,
} from "./routing-rule.schema.ts"
import * as controller from "./routing-rule.controller.ts"
const router = Router({ mergeParams: true })
router.post("/compile", authenticate, validate(compileRoutingRuleSchema), controller.compile)
router.use(authenticate)
router.get("/", controller.list)
router.post("/", validate(createRoutingRuleSchema), controller.create)
router.patch("/:ruleId", validate(updateRoutingRuleSchema), controller.update)
router.delete("/:ruleId", controller.remove)
export { router as routingRuleRouter }
