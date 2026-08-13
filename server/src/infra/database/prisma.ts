import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { env } from "@/common/config/env.ts"

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	options: "-c search_path=varta,extensions",
	max: 20,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
})

const adapter = new PrismaPg(pool, { schema: "varta" })

export function getDatabasePoolStats() {
	return {
		total: pool.totalCount,
		idle: pool.idleCount,
		waiting: pool.waitingCount,
	}
}

export async function disconnectDatabase(): Promise<void> {
	await prisma.$disconnect()
	await pool.end()
}

export const prisma = new PrismaClient({
	adapter,
	log:
		env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})
