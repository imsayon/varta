import { cpSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const standaloneClient = resolve(root, ".next/standalone/client")
mkdirSync(resolve(standaloneClient, ".next"), { recursive: true })
cpSync(resolve(root, ".next/static"), resolve(standaloneClient, ".next/static"), { recursive: true })
cpSync(resolve(root, "public"), resolve(standaloneClient, "public"), { recursive: true })
