import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	output: "standalone",
	experimental: {
		useTypeScriptCli: true,
	},
	turbopack: {
		// pnpm's shared lockfile and virtual store live at the workspace root.
		// Turbopack must use that same boundary or it cannot resolve Next.js.
		root: path.resolve(__dirname, ".."),
	},
	async rewrites() {
		const apiUrl =
			process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5000"

		return [
			{
				source: "/api/v1/:path*",
				destination: `${apiUrl}/api/v1/:path*`,
			},
			{
				source: "/api/health/:path*",
				destination: `${apiUrl}/api/health/:path*`,
			},
		]
	},
}

export default nextConfig
