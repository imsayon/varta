// Run only by delivery-recovery.integration.test.ts against its disposable fixtures.
import { executeDelivery } from "../modules/notifications/delivery-execution.service.ts"
import { NotificationChannel } from "../modules/notifications/notification.types.ts"
import { connectRedis } from "../infra/redis/redis.connection.ts"
await connectRedis()
const payload = JSON.parse(process.env.RECOVERY_TEST_PAYLOAD!)
await executeDelivery(payload, NotificationChannel.IN_APP, async () => {
	if (process.env.RECOVERY_TEST_PHASE === "after") await fetch(process.env.RECOVERY_TEST_RECEIVER!)
	process.send?.("paused")
	await new Promise(() => setInterval(() => {}, 1000))
	return { success: true, provider: "inapp" }
})
