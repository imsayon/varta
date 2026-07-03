export function buildResetPasswordEmail(
	name: string | null,
	url: string,
): string {
	const displayName = name || "there"
	return `
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
			<h2>Reset your password</h2>
			<p>Hi ${displayName},</p>
			<p>We received a request to reset your Varta password. Click the button below to choose a new one:</p>
			<div style="margin: 30px 0;">
				<a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
			</div>
			<p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
			<p style="font-size: 14px; color: #666; word-break: break-all;"><a href="${url}">${url}</a></p>
			<p style="font-size: 14px; color: #999; margin-top: 40px;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
		</div>
	`
}
