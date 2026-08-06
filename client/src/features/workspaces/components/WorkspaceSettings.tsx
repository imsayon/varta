"use client"

import { useCallback, useEffect, useState } from "react"
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
		pushPerHour?: number
	}
}

interface WorkspaceDetails extends Omit<IWorkspace, "settings"> {
	settings: WorkspaceSettingsShape
}

interface EmailProviderConfig {
	apiKey: string
	fromAddress: string
}

function readEmailProviderConfig(
	providerConfig: IProviderConfig | null | undefined,
): EmailProviderConfig {
	const config = providerConfig?.config as JsonObject | undefined

	return {
		apiKey: typeof config?.apiKey === "string" ? config.apiKey : "",
		fromAddress:
			typeof config?.fromAddress === "string" ? config.fromAddress : "",
	}
}

export function WorkspaceSettings() {
	const { workspace, setActiveWorkspace } = useAuth()

	const [workspaceData, setWorkspaceData] = useState<WorkspaceDetails | null>(
		null,
	)
	const [apiKeys, setApiKeys] = useState<IApiKey[]>([])
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [generatingKey, setGeneratingKey] = useState(false)

	const [name, setName] = useState("")
	const [defaultTimezone, setDefaultTimezone] = useState("UTC")
	const [emailLimit, setEmailLimit] = useState(1000)
	const [pushLimit, setPushLimit] = useState(5000)
	const [emailApiKey, setEmailApiKey] = useState("")
	const [emailFromAddress, setEmailFromAddress] = useState("")
	const [revealEmail, setRevealEmail] = useState(false)

	const [newKeyName, setNewKeyName] = useState("")
	const [generatedKey, setGeneratedKey] = useState<string | null>(null)
	const [copiedKey, setCopiedKey] = useState(false)

	const fetchSettings = useCallback(async () => {
		if (!workspace) {
			return
		}

		setLoading(true)

		const [workspaceRes, apiKeysRes, providerRes] = await Promise.all([
			apiClient.get<WorkspaceDetails>(
				`/api/v1/workspaces/${workspace.id}`,
			),
			apiClient.get<IApiKey[]>(
				`/api/v1/workspaces/${workspace.id}/api-keys`,
			),
			apiClient.get<IProviderConfig | null>(
				`/api/v1/workspaces/${workspace.id}/providers`,
			),
		])

		if (!workspaceRes.success) {
			toast.error(
				workspaceRes.error?.message ||
					"Failed to load workspace settings",
			)
			setLoading(false)
			return
		}

		setWorkspaceData(workspaceRes.data)
		setName(workspaceRes.data.name)
		setDefaultTimezone(workspaceRes.data.settings.defaultTimezone || "UTC")
		setEmailLimit(
			workspaceRes.data.settings.rateLimits?.emailPerHour || 1000,
		)
		setPushLimit(workspaceRes.data.settings.rateLimits?.pushPerHour || 5000)

		if (apiKeysRes.success && apiKeysRes.data) {
			setApiKeys(apiKeysRes.data)
		} else {
			setApiKeys([])
		}

		if (providerRes.success) {
			const emailProvider = readEmailProviderConfig(
				providerRes.data ?? null,
			)
			setEmailApiKey(emailProvider.apiKey)
			setEmailFromAddress(emailProvider.fromAddress)
		}

		setLoading(false)
	}, [workspace])

	useEffect(() => {
		if (!workspace) {
			return
		}

		void (async () => {
			await fetchSettings()
		})()
	}, [workspace, fetchSettings])

	const handleSaveWorkspace = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!workspace) {
			return
		}

		if (
			(emailApiKey && !emailFromAddress) ||
			(!emailApiKey && emailFromAddress)
		) {
			toast.error(
				"Email provider requires both an API key and a from address.",
			)
			return
		}

		setSaving(true)

		const workspaceRes = await apiClient.patch<WorkspaceDetails>(
			`/api/v1/workspaces/${workspace.id}`,
			{
				name,
				settings: {
					defaultTimezone,
					rateLimits: {
						emailPerHour: emailLimit,
						pushPerHour: pushLimit,
					},
				},
			},
		)

		if (!workspaceRes.success) {
			setSaving(false)
			toast.error(
				workspaceRes.error?.message ||
					"Failed to update workspace settings",
			)
			return
		}

		if (emailApiKey && emailFromAddress) {
			const providerRes = await apiClient.put<IProviderConfig>(
				`/api/v1/workspaces/${workspace.id}/providers/email`,
				{
					provider: "resend",
					config: {
						apiKey: emailApiKey,
						fromAddress: emailFromAddress,
					},
					isActive: true,
				},
			)

			if (!providerRes.success) {
				setSaving(false)
				toast.error(
					providerRes.error?.message ||
						"Workspace saved, but email provider update failed",
				)
				return
			}
		}

		setActiveWorkspace({
			id: workspaceRes.data.id,
			name: workspaceRes.data.name,
		})
		toast.success("Workspace settings updated.")
		await fetchSettings()
		setSaving(false)
	}

	const handleGenerateApiKey = async (event: React.FormEvent) => {
		event.preventDefault()
		if (!workspace || !newKeyName.trim()) {
			return
		}

		setGeneratingKey(true)
		const response = await apiClient.post<IApiKeyCreateResponse>(
			`/api/v1/workspaces/${workspace.id}/api-keys`,
			{ name: newKeyName.trim() },
		)
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
			setCopiedKey(true)
			setTimeout(() => setCopiedKey(false), 2000)
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
						Phase 1 supports workspace metadata, throttling, email
						delivery, and API keys.
					</p>
				</div>
			</div>

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
								disabled={saving}
							/>
							<Input
								label="Default Timezone"
								value={defaultTimezone}
								onChange={(event) =>
									setDefaultTimezone(event.target.value)
								}
								required
								disabled={saving}
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
								<button
									type="button"
									onClick={() =>
										setRevealEmail((value) => !value)
									}
									className={styles.revealBtn}
								>
									{revealEmail ? (
										<EyeOff size={16} />
									) : (
										<Eye size={16} />
									)}
								</button>
							</div>
							<div className={styles.providerFields}>
								<Input
									type={revealEmail ? "text" : "password"}
									label="Resend API Key"
									placeholder="re_..."
									value={emailApiKey}
									onChange={(event) =>
										setEmailApiKey(event.target.value)
									}
									disabled={saving}
								/>
								<Input
									label="From Address"
									placeholder="Varta Alerts <alerts@yourdomain.com>"
									value={emailFromAddress}
									onChange={(event) =>
										setEmailFromAddress(event.target.value)
									}
									disabled={saving}
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
								disabled={saving}
							/>
							<Input
								type="number"
								label="Maximum Push Sends / Hour"
								value={pushLimit}
								onChange={(event) =>
									setPushLimit(
										parseInt(event.target.value, 10) || 0,
									)
								}
								disabled={saving}
							/>
						</div>
					</Card>

					<Button
						type="submit"
						variant="primary"
						loading={saving}
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
								disabled={generatingKey}
							/>
							<Button
								type="submit"
								variant="secondary"
								loading={generatingKey}
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
							{apiKeys.length === 0 && (
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
