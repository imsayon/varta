import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { env } from "../config/env.ts"

const adapter = new PrismaPg({
	connectionString: env.DATABASE_URL,
})

export const prisma = new PrismaClient({
	adapter,
	log: env.NODE_ENV === "development"
		? ["query", "error", "warn"]
		: ["error"],
})
