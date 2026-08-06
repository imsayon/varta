import type { DeliveryStatus } from "@prisma/client"

const legalTransitions: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
	PENDING: ["RUNNING", "DLQ"],
	RUNNING: ["SUCCESS", "FAILED", "DLQ"],
	FAILED: ["RUNNING", "DLQ"],
	SUCCESS: [],
	DLQ: [],
}

export function canTransitionDelivery(
	from: DeliveryStatus,
	to: DeliveryStatus,
): boolean {
	return legalTransitions[from].includes(to)
}

export function assertDeliveryTransition(
	from: DeliveryStatus,
	to: DeliveryStatus,
): void {
	if (!canTransitionDelivery(from, to)) {
		throw new Error(`Illegal delivery transition: ${from} -> ${to}`)
	}
}
