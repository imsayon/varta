"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/shared/auth/auth-context"
import { apiClient } from "@/shared/api/api"
import { Card } from "@/components/ui/Card/Card"
import { Input } from "@/components/ui/Input/Input"
import { Button } from "@/components/ui/Button/Button"
import { Skeleton } from "@/components/ui/Skeleton/Skeleton"
import {
	Settings as SettingsIcon,
	Key,
	Mail,
	Eye,
	EyeOff,
	Copy,
	Check,
	Lock,
	Sliders,
	Send,
} from "lucide-react"
import { toast } from "sonner"
import type {
	IApiKey,
	IApiKeyCreateResponse,
	IProviderConfig,
	IWorkspace,
} from "@/shared/types/domain"
import type { JsonObject } from "@/shared/types/json"
import styles from "./WorkspaceSettings.module.css"

type WorkspaceSettingsShape = {
	defaultTimezone?: string
	rateLimits?: {
		emailPerHour?: number
	}
}

interface WorkspaceDetails extends Omit<IWorkspace, "settings"> {
	settings: WorkspaceSettingsShape
}

interface EmailProviderConfig {
	hasApiKey: boolean
	fromAddress: string
}

function readEmailProviderConfig(
	providerData: IProviderConfig | IProviderConfig[] | null | undefined,
): EmailProviderConfig {
	let providerRecord: IProviderConfig | undefined
	if (Array.isArray(providerData)) {
		providerRecord = providerData.find(
			(p) => p.channel === "email" || p.provider === "resend",
		)
	} else if (providerData) {
		providerRecord = providerData
	}

	const config = providerRecord?.config as JsonObject | undefined

	return {
		hasApiKey: typeof config?.apiKey === "string" && config.apiKey.length > 0,
		fromAddress:
			typeof config?.fromAddress === "string" ? config.fromAddress : "",
	}
}

export function WorkspaceSettings() {
	const { workspace } = useAuth()
	return <WorkspaceSettingsForm key={workspace?.id ?? "none"} />
}

function WorkspaceSettingsForm() {
	const { workspace, user, setActiveWorkspace, getAbortSignal } = useAuth()
	const workspaceId = workspace?.id
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => { mounted.current = false }
	}, [])

	const [workspaceData, setWorkspaceData] = useState<WorkspaceDetails | null>(
		null,
	)
	const [apiKeys, setApiKeys] = useState<IApiKey[]>([])
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [testingProvider, setTestingProvider] = useState(false)
	const [generatingKey, setGeneratingKey] = useState(false)

	const [name, setName] = useState("")
	const [defaultTimezone, setDefaultTimezone] = useState("UTC")
	const [emailLimit, setEmailLimit] = useState(1000)
	const [emailApiKey, setEmailApiKey] = useState("")
	const [hasEmailApiKey, setHasEmailApiKey] = useState(false)
	const [providerLoaded, setProviderLoaded] = useState(false)
	const [apiKeysLoaded, setApiKeysLoaded] = useState(false)
	const [loadErrors, setLoadErrors] = useState<string[]>([])
	const [emailFromAddress, setEmailFromAddress] = useState("")
	const [revealEmail, setRevealEmail] = useState(false)

	const [newKeyName, setNewKeyName] = useState("")
	const [generatedKey, setGeneratedKey] = useState<string | null>(null)
	const [copiedKey, setCopiedKey] = useState(false)

	const fetchSettings = useCallback(async () => {
		if (!workspaceId) return
		const signal = getAbortSignal()
		setLoading(true)
		setSaving(false)
		setTestingProvider(false)
		setGeneratingKey(false)
		setWorkspaceData(null)
		setProviderLoaded(false)
		setApiKeysLoaded(false)
		setEmailApiKey("")
		setHasEmailApiKey(false)
		setEmailFromAddress("")
		setApiKeys([])
		setLoadErrors([])
		const [workspaceRes, apiKeysRes, providerRes] = await Promise.all([
			apiClient.get<WorkspaceDetails>(`/api/v1/workspaces/${workspaceId}`),
			apiClient.get<IApiKey[]>(`/api/v1/workspaces/${workspaceId}/api-keys`),
			apiClient.get<IProviderConfig[]>(`/api/v1/workspaces/${workspaceId}/providers`),
		])
		if (signal.aborted || !mounted.current) return

		const errors: string[] = []
		if (workspaceRes.success) {
			setWorkspaceData(workspaceRes.data)
			setName(workspaceRes.data.name)
			setDefaultTimezone(workspaceRes.data.settings?.defaultTimezone || "UTC")
			setEmailLimit(workspaceRes.data.settings?.rateLimits?.emailPerHour ?? 1000)
		} else errors.push("Failed to load workspace settings.")

		if (apiKeysRes.success) {
			setApiKeys(apiKeysRes.data ?? [])
			setApiKeysLoaded(true)
		} else errors.push("Failed to load API integration keys.")

		if (providerRes.success) {
			const emailProvider = readEmailProviderConfig(providerRes.data ?? null)
			setHasEmailApiKey(emailProvider.hasApiKey)
			setEmailFromAddress(emailProvider.fromAddress)
			setProviderLoaded(true)
		} else errors.push("Failed to load email provider settings.")
		setLoadErrors(errors)
		setLoading(false)
	}, [workspaceId, getAbortSignal])

	useEffect(() => {
		if (!workspace) return
		void (async () => {
			await fetchSettings()
		})()
	}, [workspace, fetchSettings])

	const handleTestProvider = async () => {
		if (!workspace || !providerLoaded || !hasEmailApiKey) return
		const signal = getAbortSignal()
		setTestingProvider(true)

		const res = await apiClient.post(
			`/api/v1/workspaces/${workspace.id}/providers/email/test`,
		)
		if (signal.aborted || !mounted.current) return
		setTestingProvider(false)

		if (res.success) {
			toast.success("Resend provider connectivity test passed!")
		} else {
			toast.error(res.error?.message || "Provider test failed. Please verify API key.")
		}
	}

	const handleSaveWorkspace = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!workspace || !workspaceData || saving) {
			return
		}

		if (providerLoaded && (
			((emailApiKey || hasEmailApiKey) && !emailFromAddress) ||
			(!emailApiKey && !hasEmailApiKey && emailFromAddress)
		)) {
			toast.error(
				"Email provider requires both an API key and a from address.",
			)
			return
		}

		const signal = getAbortSignal()
		setSaving(true)

		const workspaceRes = await apiClient.patch<WorkspaceDetails>(
			`/api/v1/workspaces/${workspace.id}`,
			{
				name,
				settings: {
					defaultTimezone,
					rateLimits: {
						emailPerHour: emailLimit,
					},
				},
			},
		)

		if (signal.aborted || !mounted.current) return
		if (!workspaceRes.success) {
			setSaving(false)
			toast.error(
				workspaceRes.error?.message ||
					"Failed to update workspace settings",
			)
			return
		}

		if (providerLoaded && (emailApiKey || hasEmailApiKey) && emailFromAddress) {
			const providerRes = await apiClient.put<IProviderConfig>(
				`/api/v1/workspaces/${workspace.id}/providers/email`,
				{
					provider: "resend",
					config: {
						...(emailApiKey ? { apiKey: emailApiKey } : {}),
						fromAddress: emailFromAddress,
					},
					isActive: true,
				},
			)

			if (signal.aborted || !mounted.current) return
			if (!providerRes.success) {
				setSaving(false)
				toast.error(
					providerRes.error?.message ||
						"Workspace saved, but email provider update failed",
				)
				return
			}
		}

		setWorkspaceData(workspaceRes.data)
		setHasEmailApiKey(hasEmailApiKey || Boolean(emailApiKey))
		setEmailApiKey("")
		setSaving(false)
		setActiveWorkspace({
			id: workspaceRes.data.id,
			name: workspaceRes.data.name,
			role: workspace.role,
		})
		toast.success("Workspace settings updated.")
	}

	const handleGenerateApiKey = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!workspace || !apiKeysLoaded || generatingKey || !newKeyName.trim()) {
			return
		}

		const signal = getAbortSignal()
		setGeneratingKey(true)
		const response = await apiClient.post<IApiKeyCreateResponse>(
			`/api/v1/workspaces/${workspace.id}/api-keys`,
			{ name: newKeyName.trim() },
		)
		if (signal.aborted || !mounted.current) return
		setGeneratingKey(false)

		if (!response.success) {
			toast.error(response.error?.message || "Failed to generate API key")
			return
		}

		setGeneratedKey(response.data.fullKey)
		setNewKeyName("")
		toast.success(
			"API key generated. Copy it now; it will not be shown again.",
		)
		await fetchSettings()
	}

	const copyToClipboard = async () => {
		if (!generatedKey) {
			return
		}

		try {
			await navigator.clipboard.writeText(generatedKey)
			if (!mounted.current) return
			setCopiedKey(true)
			setTimeout(() => { if (mounted.current) setCopiedKey(false) }, 2000)
		} catch {
			toast.error("Failed to copy API key")
		}
	}

	if (loading) {
		return (
			<div className={styles.loadingGrid}>
				<Skeleton height={200} />
				<Skeleton height={360} />
				<Skeleton height={200} />
			</div>
		)
	}

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div>
					<h1 className={styles.title}>Settings</h1>
					<p className={styles.subtitle}>
						Manage workspace settings, rate limits, provider credentials, and API integration keys.
					</p>
				</div>
			</div>

			{user?.emailVerified === false && (
				<div style={{ padding: "1rem", backgroundColor: "#7f1d1d", borderRadius: "0.5rem", color: "#fecaca", marginBottom: "1.5rem" }}>
					<strong>Unverified Account:</strong> Please verify your email address to access administrative workspace settings.
				</div>
			)}

			{loadErrors.length > 0 && (
				<div role="alert">
					{loadErrors.map(message => <p key={message}>{message}</p>)}
					<Button type="button" variant="secondary" onClick={() => void fetchSettings()}>Retry loading settings</Button>
				</div>
			)}

			<div className={styles.layout}>
				<form
					onSubmit={handleSaveWorkspace}
					className={styles.mainForm}
				>
					<Card className={styles.settingsCard}>
						<h3 className={styles.cardTitle}>
							<SettingsIcon size={16} />
							<span>Workspace General</span>
						</h3>
						<div className={styles.row}>
							<Input
								label="Workspace Name"
								value={name}
								onChange={(event) =>
									setName(event.target.value)
								}
								required
								disabled={saving || !workspaceData}
							/>
							<Input
								label="Default Timezone"
								value={defaultTimezone}
								onChange={(event) =>
									setDefaultTimezone(event.target.value)
								}
								required
								disabled={saving || !workspaceData}
							/>
						</div>
						{workspaceData && (
							<div className={styles.keysList}>
								<span className={styles.label}>
									Workspace Slug
								</span>
								<span className={styles.keyLabelText}>
									{workspaceData.slug}
								</span>
							</div>
						)}
					</Card>

					<Card className={styles.settingsCard}>
						<h3 className={styles.cardTitle}>
							<Mail size={16} />
							<span>Email Provider</span>
						</h3>
						<div className={styles.providerBox}>
							<div className={styles.providerHeader}>
								<div className={styles.providerTitle}>
									<Mail
										size={18}
										className={styles.emailIcon}
									/>
									<span>Resend</span>
								</div>
								<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
									<button
										type="button"
										onClick={handleTestProvider}
										disabled={testingProvider || saving || !providerLoaded || !hasEmailApiKey}
										className={styles.revealBtn}
										title="Test Resend connection"
										style={{ opacity: hasEmailApiKey ? 1 : 0.5 }}
									>
										<Send size={14} />
										<span style={{ marginLeft: "4px", fontSize: "0.75rem" }}>
											{testingProvider ? "Testing..." : "Test"}
										</span>
									</button>
									<button
										type="button"
										aria-label={revealEmail ? "Hide replacement API key" : "Show replacement API key"}
										disabled={!providerLoaded}
										onClick={() => setRevealEmail((value) => !value)}
										className={styles.revealBtn}
									>
										{revealEmail ? (
											<EyeOff size={16} />
										) : (
											<Eye size={16} />
										)}
									</button>
								</div>
							</div>
							<div className={styles.providerFields}>
								<Input
									type={revealEmail ? "text" : "password"}
									label="Resend API Key"
									placeholder={hasEmailApiKey ? "Configured; leave blank to keep current key" : "re_..."}
									value={emailApiKey}
									onChange={(event) =>
										setEmailApiKey(event.target.value)
									}
									disabled={saving || !providerLoaded}
								/>
								<Input
									label="From Address"
									placeholder="Varta Alerts <alerts@yourdomain.com>"
									value={emailFromAddress}
									onChange={(event) =>
										setEmailFromAddress(event.target.value)
									}
									disabled={saving || !providerLoaded}
								/>
							</div>
						</div>
					</Card>

					<Card className={styles.settingsCard}>
						<h3 className={styles.cardTitle}>
							<Sliders size={16} />
							<span>Workspace Throttle Limits</span>
						</h3>
						<div className={styles.row}>
							<Input
								type="number"
								label="Maximum Email Sends / Hour"
								value={emailLimit}
								onChange={(event) =>
									setEmailLimit(
										parseInt(event.target.value, 10) || 0,
									)
								}
								disabled={saving || !workspaceData}
							/>
						</div>
					</Card>

					<Button
						type="submit"
						variant="primary"
						loading={saving}
						disabled={!workspaceData}
						className={styles.saveBtn}
					>
						<Lock size={16} />
						<span>Save Configuration</span>
					</Button>
				</form>

				<div className={styles.sideColumn}>
					<Card className={styles.settingsCard}>
						<h3 className={styles.cardTitle}>
							<Key size={16} />
							<span>API Integration Keys</span>
						</h3>

						{generatedKey && (
							<div className={styles.newKeyBox}>
								<div className={styles.newKeyHeader}>
									<span>Copy API key:</span>
									<button
										onClick={copyToClipboard}
										className={styles.copyBtn}
									>
										{copiedKey ? (
											<Check
												size={14}
												className="text-emerald"
											/>
										) : (
											<Copy size={14} />
										)}
										<span>
											{copiedKey ? "Copied" : "Copy"}
										</span>
									</button>
								</div>
								<div className={styles.rawKeyValue}>
									{generatedKey}
								</div>
								<p className={styles.warningText}>
									This key will not be shown again. Store it
									securely.
								</p>
							</div>
						)}

						<form
							onSubmit={handleGenerateApiKey}
							className={styles.generateForm}
						>
							<Input
								label="Generate API Key"
								placeholder="Key name, e.g. Production Backend"
								value={newKeyName}
								onChange={(event) =>
									setNewKeyName(event.target.value)
								}
								required
								disabled={generatingKey || !apiKeysLoaded}
							/>
							<Button
								type="submit"
								variant="secondary"
								loading={generatingKey}
								disabled={!apiKeysLoaded}
							>
								<Key size={14} />
								<span>Generate Key</span>
							</Button>
						</form>

						<div className={styles.keysList}>
							<span className={styles.label}>
								Active Access Keys
							</span>
							{apiKeys.map((apiKey) => (
								<div key={apiKey.id} className={styles.keyItem}>
									<span className={styles.keyLabelText}>
										{apiKey.name}
									</span>
									<span className={styles.keyDate}>
										Created{" "}
										{new Date(
											apiKey.createdAt,
										).toLocaleDateString()}
									</span>
								</div>
							))}
							{apiKeysLoaded && apiKeys.length === 0 && (
								<span className={styles.noKeys}>
									No API keys generated yet.
								</span>
							)}
						</div>
					</Card>
				</div>
			</div>
		</div>
	)
}
