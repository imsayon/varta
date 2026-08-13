import { describe, it } from "node:test"
import assert from "node:assert/strict"
import Handlebars from "handlebars"
import DOMPurify from "isomorphic-dompurify"
import { createTemplateSchema, updateTemplateSchema } from "./template.schema.ts"

describe("C6 Template Journey Unit Suite", () => {
	it("renders Handlebars template variables and sanitizes HTML output", () => {
		const rawTemplate = "<h1>Hello {{name}}</h1><script>alert('xss')</script>"
		const render = Handlebars.compile(rawTemplate, { strict: false })
		const rawHtml = render({ name: "Alice" })

		assert.ok(rawHtml.includes("Hello Alice"))
		assert.ok(rawHtml.includes("<script>"))

		const sanitized = DOMPurify.sanitize(rawHtml)
		assert.ok(sanitized.includes("Hello Alice"))
		assert.equal(sanitized.includes("<script>"), false)
	})

	it("validates template creation schema across channels", () => {
		const valid = createTemplateSchema.parse({
			name: "order_confirmation",
			description: "Sent when order is placed",
			channels: {
				email: { subject: "Order {{orderId}}", htmlBody: "<p>Thank you!</p>" },
				inapp: { title: "Order Confirmed", body: "Your order is placed." },
			},
			aiPersonalize: false,
			isActive: true,
		})

		const channels = valid.channels as any

		assert.equal(valid.name, "order_confirmation")
		assert.equal(channels.email?.subject, "Order {{orderId}}")
		assert.equal(channels.inapp?.title, "Order Confirmed")
	})

	it("validates template update schema", () => {
		const updated = updateTemplateSchema.parse({
			isActive: false,
			channels: {
				webhook: { payload: '{"event": "cancelled"}' },
			},
		})

		const channels = updated.channels as any

		assert.equal(updated.isActive, false)
		assert.equal(channels?.webhook?.payload, '{"event": "cancelled"}')
	})
})
