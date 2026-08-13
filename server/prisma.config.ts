import "dotenv/config"
import { defineConfig } from "prisma/config"

const directUrl = process.env.DIRECT_URL?.trim()

if (!directUrl) {
	throw new Error("DIRECT_URL is required for Prisma CLI and migration commands")
}

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: directUrl,
	},
})
