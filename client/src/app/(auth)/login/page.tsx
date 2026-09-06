"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/shared/auth/auth-context"
import { validateRedirectUrl } from "@/proxy"
import { Card } from "@/components/ui/Card/Card"
import { Input } from "@/components/ui/Input/Input"
import { Button } from "@/components/ui/Button/Button"
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon"
import styles from "./LoginPage.module.css"

function LoginForm() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const { login } = useAuth()
	const oauthReturnTo = encodeURIComponent(validateRedirectUrl(searchParams.get("from")))
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errors, setErrors] = useState<Record<string, string>>({})

	const validate = () => {
		const nextErrors: Record<string, string> = {}
		if (!email) nextErrors.email = "Email is required"
		else if (!/\S+@\S+\.\S+/.test(email))
			nextErrors.email = "Invalid email address"
		if (!password) nextErrors.password = "Password is required"
		else if (password.length < 6)
			nextErrors.password = "Password must be at least 6 characters"

		setErrors(nextErrors)
		return Object.keys(nextErrors).length === 0
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!validate()) return

		setIsSubmitting(true)
		const res = await login(email, password)
		setIsSubmitting(false)

		if (res.success) {
			toast.success("Successfully logged in!")
			const target = validateRedirectUrl(searchParams.get("from"))
			router.push(target)
		} else {
			toast.error(res.error || "Invalid credentials")
		}
	}

	return (
		<Card padding="lg">
			<div className={styles.header}>
				<h2 className={styles.title}>Welcome back</h2>
				<p className={styles.subtitle}>
					Sign in to manage your notification pipeline
				</p>
			</div>

			<div className={styles.divider} role="separator">
				<span>or continue with</span>
			</div>
			<div className={styles.oauthProviders}>
				<a
					href={`/api/v1/auth/oauth/google?returnTo=${oauthReturnTo}`}
					className={`${styles.oauthBtn} ${styles.googleBtn}`}
				>
					<OAuthProviderIcon provider="google" />
					<span>Continue with Google</span>
				</a>
				<a
					href={`/api/v1/auth/oauth/github?returnTo=${oauthReturnTo}`}
					className={`${styles.oauthBtn} ${styles.githubBtn}`}
				>
					<OAuthProviderIcon provider="github" />
					<span>Continue with GitHub</span>
				</a>
			</div>

			<form onSubmit={handleSubmit} className={styles.form}>
				<Input
					type="email"
					label="Email Address"
					placeholder="name@company.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					error={errors.email}
					disabled={isSubmitting}
					required
				/>

				<Input
					type="password"
					label="Password"
					placeholder="••••••••"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					error={errors.password}
					disabled={isSubmitting}
					required
				/>

				<div style={{ textAlign: "right", marginTop: "-0.5rem", marginBottom: "1rem" }}>
					<Link href="/forgot-password" className={styles.recoveryLink}>
						Forgot password?
					</Link>
				</div>

				<Button
					type="submit"
					variant="primary"
					size="lg"
					loading={isSubmitting}
					className={styles.submitBtn}
				>
					Sign In
				</Button>
			</form>

			<div className={styles.footer}>
				<span>New to Varta?</span>{" "}
				<Link href="/signup" className={styles.link}>
					Create an account
				</Link>
			</div>
		</Card>
	)
}

export default function LoginPage() {
	return (
		<Suspense fallback={<Card padding="lg">Loading...</Card>}>
			<LoginForm />
		</Suspense>
	)
}
