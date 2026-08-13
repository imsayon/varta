import assert from "node:assert/strict"
import test from "node:test"
import { createRazorpayClient, type RazorpayFetch } from "./razorpay.client.ts"

const enabled = process.env.RUN_RAZORPAY_CONTRACT_TESTS === "true"

test("Razorpay client uses the fixed HTTPS origin and validates responses", { skip: !enabled }, async () => {
	let observedUrl = ""
	const client = createRazorpayClient((async (input) => {
		observedUrl = String(input)
		return new Response(JSON.stringify({ id: "cust_fixture" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}) as RazorpayFetch)
	assert.equal(await client.createCustomer({ name: "Owner", email: "owner@example.test" }), "cust_fixture")
	assert.equal(observedUrl, "https://api.razorpay.com/v1/customers")
})

test("Razorpay client bounds a stalled provider request", { skip: !enabled }, async () => {
	const client = createRazorpayClient(((_input, init) => new Promise((_resolve, reject) => {
		init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
	})) as RazorpayFetch)
	await assert.rejects(
		() => client.createCustomer({ name: "Owner", email: "owner@example.test" }),
		/Razorpay payment gateway unavailable/,
	)
})

test("Razorpay client rejects malformed provider contracts", { skip: !enabled }, async () => {
	const client = createRazorpayClient((async () => new Response(JSON.stringify({ not_an_id: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})) as RazorpayFetch)
	await assert.rejects(
		() => client.createCustomer({ name: "Owner", email: "owner@example.test" }),
		/Razorpay returned an invalid response/,
	)
})

test("Razorpay cancellation is fixed to the provider subscription path and period end", { skip: !enabled }, async () => {
	let observedUrl = ""
	let observedBody = ""
	const client = createRazorpayClient((async (input, init) => {
		observedUrl = String(input)
		observedBody = String(init?.body)
		return new Response(JSON.stringify({ id: "sub_fixture", status: "active" }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	}) as RazorpayFetch)
	await client.cancelSubscription("sub_fixture", true)
	assert.equal(observedUrl, "https://api.razorpay.com/v1/subscriptions/sub_fixture/cancel")
	assert.deepEqual(JSON.parse(observedBody), { cancel_at_cycle_end: 1 })
})
