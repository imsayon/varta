import passport from "passport"
import { Strategy as GoogleStrategy } from "passport-google-oauth20"
import { Strategy as GitHubStrategy } from "passport-github2"
import type { Profile as PassportProfile } from "passport"
import { env } from "@/common/config/env.ts"
import { authService } from "./auth.service.ts"

type VerifyDone = (error: Error | null, user?: Express.User | false) => void

interface PrimaryEmailProfile extends PassportProfile {
	emails?: Array<{ value: string; primary?: boolean }>
	username?: string
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
	passport.use(
		new GoogleStrategy(
			{
				clientID: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
				callbackURL: env.GOOGLE_CALLBACK_URL,
			},
			async (accessToken, refreshToken, profile, done) => {
				try {
					const user = await authService.handleOAuthLogin({
						provider: "google",
						providerUid: profile.id,
						email: profile.emails?.[0]?.value || "",
						name: profile.displayName || "Google User",
						accessToken,
						refreshToken,
					})
					done(null, user)
				} catch (err) {
					done(err instanceof Error ? err : new Error("OAuth login failed"))
				}
			},
		),
	)
}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
	passport.use(
		new GitHubStrategy(
			{
				clientID: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				callbackURL: env.GITHUB_CALLBACK_URL,
				scope: ["user:email"],
			},
			async (
				accessToken: string,
				refreshToken: string,
				profile: PrimaryEmailProfile,
				done: VerifyDone,
			) => {
				try {
					const email =
						profile.emails?.find((emailRecord) => emailRecord.primary)
							?.value ||
						profile.emails?.[0]?.value ||
						""
					const user = await authService.handleOAuthLogin({
						provider: "github",
						providerUid: profile.id,
						email,
						name:
							profile.displayName ||
							profile.username ||
							"GitHub User",
						accessToken,
						refreshToken,
					})
					done(null, user)
				} catch (err) {
					done(err instanceof Error ? err : new Error("OAuth login failed"))
				}
			},
		),
	)
}

export { passport }
