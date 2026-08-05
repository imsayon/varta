export const MAX_DELIVERY_ATTEMPTS = 5

export const DEFAULT_JOB_OPTIONS = {
	attempts: MAX_DELIVERY_ATTEMPTS,

	removeOnComplete: {
		age: 3600,
		count: 1000,
	},

	removeOnFail: {
		age: 86400,
	},

	backoff: {
		type: "exponential",
		delay: 2000,
	},
}
