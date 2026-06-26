import { Resend } from "resend"
import { env } from "@/shared/config/env.ts"

export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
