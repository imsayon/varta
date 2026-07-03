import pino from "pino"
import { env } from "@/common/config/env.ts"

export const logger = pino({
	name: "varta",
	level: env.NODE_ENV === "production" ? "info" : "debug",
	...(env.NODE_ENV === "development" && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:HH:MM:ss.l",
				ignore: "pid,hostname",
			},
		},
	}),
})
