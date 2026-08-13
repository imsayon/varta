import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const outputPath = resolve(repoRoot, process.argv[2] ?? "artifacts/release-manifest.json")

function envValue(name) {
	const value = process.env[name]?.trim()
	return value || null
}

function sha256File(path) {
	if (!existsSync(path)) return null
	return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function gitValue(args) {
	try {
		return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim() || null
	} catch {
		return null
	}
}

function pnpmVersion() {
	const userAgent = process.env.npm_config_user_agent ?? ""
	return userAgent.match(/(?:^|\s)pnpm\/([^\s]+)/)?.[1] ?? null
}

function imageReference(name) {
	const configured = envValue(name)
	if (!configured) return null
	try {
		return execFileSync("docker", ["image", "inspect", "--format={{.Id}}", configured], {
			cwd: repoRoot,
			encoding: "utf8",
		}).trim() || configured
	} catch {
		return configured
	}
}

function packageVersion(packagePath) {
	try {
		return JSON.parse(readFileSync(resolve(repoRoot, packagePath), "utf8")).version ?? null
	} catch {
		return null
	}
}

function migrationNames() {
	const migrationsRoot = resolve(repoRoot, "server/prisma/migrations")
	if (!existsSync(migrationsRoot)) return []
	return readdirSync(migrationsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()
}

function parseJsonEnv(name) {
	const value = envValue(name)
	if (!value) return null
	try {
		return JSON.parse(value)
	} catch {
		throw new Error(`${name} must contain valid JSON`)
	}
}

const artifactPaths = [
	"artifacts/server-test.tap",
	"artifacts/server-sbom.cdx.json",
	"artifacts/client-sbom.cdx.json",
]

const manifest = {
	schemaVersion: 1,
	releaseVersion: envValue("RELEASE_VERSION"),
	commit: envValue("RELEASE_SHA") ?? gitValue(["rev-parse", "HEAD"]),
	operation: envValue("RELEASE_OPERATION") ?? "build",
	generatedAt: new Date().toISOString(),
	runtime: {
		node: process.version,
		pnpm: pnpmVersion(),
		pinnedNode: readFileSync(resolve(repoRoot, ".node-version"), "utf8").trim(),
		pinnedPackageManager: "pnpm@11.20.0",
	},
	packages: {
		client: packageVersion("client/package.json"),
		server: packageVersion("server/package.json"),
	},
	lockfile: {
		path: "pnpm-lock.yaml",
		sha256: sha256File(resolve(repoRoot, "pnpm-lock.yaml")),
	},
	images: {
		server: imageReference("RELEASE_SERVER_IMAGE"),
		client: imageReference("RELEASE_CLIENT_IMAGE"),
		serverSbomSha256: sha256File(resolve(repoRoot, "artifacts/server-sbom.cdx.json")),
		clientSbomSha256: sha256File(resolve(repoRoot, "artifacts/client-sbom.cdx.json")),
	},
	database: {
		migrationDirectories: migrationNames(),
		migrationLockSha256: sha256File(resolve(repoRoot, "server/prisma/migrations/migration_lock.toml")),
	},
	tests: parseJsonEnv("RELEASE_TESTS_JSON"),
	riskRegister: parseJsonEnv("RELEASE_RISKS_JSON"),
	rollbackPoint: envValue("RELEASE_ROLLBACK_POINT"),
	deployments: {
		api: envValue("API_DEPLOY_ID"),
		client: envValue("CLIENT_DEPLOY_ID"),
		run: envValue("GITHUB_RUN_ID"),
	},
	artifacts: Object.fromEntries(
		artifactPaths
			.filter((relativePath) => existsSync(resolve(repoRoot, relativePath)))
			.map((relativePath) => [relativePath, sha256File(resolve(repoRoot, relativePath))]),
	),
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Release manifest written to ${outputPath}`)
