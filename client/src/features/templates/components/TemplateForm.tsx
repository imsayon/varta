"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/Modal/Modal"
import { Input, TextArea } from "@/components/ui/Input/Input"
import { Button } from "@/components/ui/Button/Button"
import { Sparkles } from "lucide-react"
import type {
	ITemplate,
	ITemplateChannels,
	TemplateUpsertInput,
} from "@/shared/types/domain"
import styles from "./TemplateForm.module.css"

interface TemplateFormProps {
	isOpen: boolean
	onClose: () => void
	onSubmit: (data: TemplateUpsertInput) => Promise<void>
	initialData?: ITemplate | null
}

type ChannelTab = "email" | "inapp" | "webhook"

function getInitialTemplateFormState(initialData?: ITemplate | null) {
	return {
		name: initialData?.name ?? "",
		active: initialData?.isActive ?? true,
		aiPersonalize: initialData?.aiPersonalize ?? false,
		emailSubject: initialData?.channels.email?.subject ?? "",
		emailBody: initialData?.channels.email?.htmlBody ?? "",
		inAppTitle: initialData?.channels.inapp?.title ?? "",
		inAppBody: initialData?.channels.inapp?.body ?? "",
		inAppActionUrl: initialData?.channels.inapp?.actionUrl ?? "",
		webhookPayload:
			initialData?.channels.webhook?.payload ??
			'{\n  "event": "{{event}}",\n  "userId": "{{subscriber.id}}"\n}',
	}
}

export function TemplateForm({
	isOpen,
	onClose,
	onSubmit,
	initialData,
}: TemplateFormProps) {
	const initialState = getInitialTemplateFormState(initialData)
	const [name, setName] = useState(initialState.name)
	const [active, setActive] = useState(initialState.active)
	const [aiPersonalize, setAiPersonalize] = useState(
		initialState.aiPersonalize,
	)
	const [activeTab, setActiveTab] = useState<ChannelTab>("email")
	const [loading, setLoading] = useState(false)

	// Email Config
	const [emailSubject, setEmailSubject] = useState(initialState.emailSubject)
	const [emailBody, setEmailBody] = useState(initialState.emailBody)

	// In-App Config
	const [inAppTitle, setInAppTitle] = useState(initialState.inAppTitle)
	const [inAppBody, setInAppBody] = useState(initialState.inAppBody)
	const [inAppActionUrl, setInAppActionUrl] = useState(
		initialState.inAppActionUrl,
	)

	// Webhook Config
	const [webhookPayload, setWebhookPayload] = useState(
		initialState.webhookPayload,
	)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!name.trim()) return

		setLoading(true)

		const channels: ITemplateChannels = {}
		if (emailSubject || emailBody) {
			channels.email = { subject: emailSubject, htmlBody: emailBody }
		}
		if (inAppTitle || inAppBody) {
			channels.inapp = {
				title: inAppTitle,
				body: inAppBody,
				actionUrl: inAppActionUrl,
			}
		}

		if (webhookPayload) {
			channels.webhook = { payload: webhookPayload }
		}

		const payload: TemplateUpsertInput = {
			name,
			isActive: active,
			aiPersonalize,
			channels,
		}

		try {
			await onSubmit(payload)
			onClose()
		} catch {
			// Error is caught by parent
		} finally {
			setLoading(false)
		}
	}

	const tabs: { value: ChannelTab; label: string }[] = [
		{ value: "email", label: "Email" },
		{ value: "inapp", label: "In-App" },

		{ value: "webhook", label: "Webhook" },
	]

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={
				initialData ? "Edit Template" : "Create Notification Template"
			}
		>
			<form onSubmit={handleSubmit} className={styles.form}>
				<div className={styles.metadataRow}>
					<Input
						label="Template Name"
						placeholder="e.g. order_shipped"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						disabled={!!initialData || loading} // Name cannot be changed if editing
						className={styles.nameInput}
					/>

					<div className={styles.optionsCol}>
						<label className={styles.toggleLabel}>
							<input
								type="checkbox"
								checked={active}
								onChange={(e) => setActive(e.target.checked)}
								disabled={loading}
							/>
							<span>Active</span>
						</label>

						<label
							className={`${styles.toggleLabel} ${styles.aiLabel}`}
						>
							<input
								type="checkbox"
								checked={aiPersonalize}
								onChange={(e) =>
									setAiPersonalize(e.target.checked)
								}
								disabled={loading}
							/>
							<Sparkles size={14} className={styles.sparkle} />
							<span>AI Personalization</span>
						</label>
					</div>
				</div>

				{/* Tab Navigation */}
				<div className={styles.tabsHeader}>
					{tabs.map((tab) => {
						const hasConfig =
							(tab.value === "email" &&
								(emailSubject || emailBody)) ||
							(tab.value === "inapp" &&
								(inAppTitle || inAppBody)) ||
							(tab.value === "webhook" &&
								webhookPayload &&
								webhookPayload.length > 5)

						return (
							<button
								key={tab.value}
								type="button"
								className={`${styles.tabBtn} ${activeTab === tab.value ? styles.tabBtnActive : ""}`}
								onClick={() => setActiveTab(tab.value)}
							>
								<span>{tab.label}</span>
								{hasConfig && (
									<span className={styles.activeDot} />
								)}
							</button>
						)
					})}
				</div>

				{/* Tab Content */}
				<div className={styles.tabContent}>
					{activeTab === "email" && (
						<div className={styles.pane}>
							<Input
								label="Subject Line"
								placeholder="Your order {{orderId}} has shipped!"
								value={emailSubject}
								onChange={(e) =>
									setEmailSubject(e.target.value)
								}
								disabled={loading}
							/>
							<TextArea
								label="HTML Body (Handlebars supported)"
								placeholder="<h1>Hello {{subscriber.attributes.name}}</h1><p>Your order is on the way...</p>"
								value={emailBody}
								onChange={(e) => setEmailBody(e.target.value)}
								rows={8}
								mono
								disabled={loading}
							/>
						</div>
					)}

					{activeTab === "inapp" && (
						<div className={styles.pane}>
							<Input
								label="Notification Title"
								placeholder="Alert"
								value={inAppTitle}
								onChange={(e) => setInAppTitle(e.target.value)}
								disabled={loading}
							/>
							<TextArea
								label="Body Text"
								placeholder="Hi {{subscriber.attributes.name}}, you received a new message."
								value={inAppBody}
								onChange={(e) => setInAppBody(e.target.value)}
								rows={4}
								disabled={loading}
							/>
							<Input
								label="Action Link (Optional URL)"
								placeholder="/dashboard/orders/{{orderId}}"
								value={inAppActionUrl}
								onChange={(e) =>
									setInAppActionUrl(e.target.value)
								}
								disabled={loading}
							/>
						</div>
					)}

					{activeTab === "webhook" && (
						<div className={styles.pane}>
							<TextArea
								label="JSON Payload (Interpolated at runtime)"
								placeholder='{\n  "event": "{{event}}"\n}'
								value={webhookPayload}
								onChange={(e) =>
									setWebhookPayload(e.target.value)
								}
								rows={8}
								mono
								disabled={loading}
							/>
						</div>
					)}
				</div>

				<div className={styles.footerActions}>
					<Button
						type="button"
						variant="ghost"
						onClick={onClose}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button type="submit" variant="primary" loading={loading}>
						{initialData ? "Save Changes" : "Create Template"}
					</Button>
				</div>
			</form>
		</Modal>
	)
}
