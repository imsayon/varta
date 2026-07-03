export function buildVerificationEmail(
	name: string | null,
	url: string,
): string {
	const displayName = name || "there"
	return `
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
			<h2>Verify your email address</h2>
			<p>Hi ${displayName},</p>
			<p>Welcome to Varta! Please click the button below to verify your email address and finish setting up your account.</p>
			<div style="margin: 30px 0;">
				<a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
			</div>
			<p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
			<p style="font-size: 14px; color: #666; word-break: break-all;"><a href="${url}">${url}</a></p>
			<p style="font-size: 14px; color: #999; margin-top: 40px;">If you didn't request this email, you can safely ignore it.</p>
		</div>
	`
}
