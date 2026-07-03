export const DEFAULT_JOB_OPTIONS = {
	attempts: 5,

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
