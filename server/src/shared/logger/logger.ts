import pino from "pino"
import { env } from "../config/env.ts"

export const logger = pino({
	name: "varta",
	level: env.NODE_ENV === "production" ? "info" : "debug",
	transport:
		env.NODE_ENV === "development"
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:HH:MM:ss.l",
						ignore: "pid,hostname",
					},
				}
			: undefined,
})
