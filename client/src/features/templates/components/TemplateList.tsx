"use client"

import { useCallback, useEffect, useState } from "react"
import { Edit2, Eye, FileText, Plus, Trash2, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/shared/api/api"
import { useAuth } from "@/shared/auth/auth-context"
import { Button } from "@/components/ui/Button/Button"
import { Skeleton } from "@/components/ui/Skeleton/Skeleton"
import { EmptyState } from "@/components/ui/EmptyState/EmptyState"
import { Modal } from "@/components/ui/Modal/Modal"
import { TemplateForm } from "./TemplateForm"
import type { ITemplate, TemplateUpsertInput } from "@/shared/types/domain"
import styles from "./TemplateList.module.css"

export function TemplateList() {
	const { workspace } = useAuth()
	const [templates, setTemplates] = useState<ITemplate[]>([])
	const [loading, setLoading] = useState(true)

	// Modal States
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null)

	// Preview Modal State
	const [previewTemplate, setPreviewTemplate] = useState<ITemplate | null>(null)
	const [previewHtml, setPreviewHtml] = useState<string>("")
	const [previewLoading, setPreviewLoading] = useState(false)

	const fetchTemplates = useCallback(async () => {
		if (!workspace) return
		setLoading(true)

		const res = await apiClient.get<ITemplate[]>(
			`/api/v1/workspaces/${workspace.id}/templates`,
		)

		if (!res.success) {
			toast.error(res.error?.message || "Failed to load templates")
			setTemplates([])
		} else if (res.data) {
			setTemplates(res.data)
		}
		setLoading(false)
	}, [workspace])

	useEffect(() => {
		const timer = window.setTimeout(() => void fetchTemplates(), 0)
		return () => window.clearTimeout(timer)
	}, [fetchTemplates])

	const handleCreateOrUpdate = async (data: TemplateUpsertInput) => {
		if (!workspace) return

		let res
		if (editingTemplate) {
			res = await apiClient.patch<ITemplate>(
				`/api/v1/workspaces/${workspace.id}/templates/${editingTemplate.id}`,
				data,
			)
		} else {
			res = await apiClient.post<ITemplate>(
				`/api/v1/workspaces/${workspace.id}/templates`,
				data,
			)
		}

		if (res.success) {
			toast.success(editingTemplate ? "Template updated" : "Template created")
			setIsFormOpen(false)
			setEditingTemplate(null)
			await fetchTemplates()
		} else {
			const errMsg = res.error?.message || "Operation failed"
			toast.error(errMsg)
			throw new Error(errMsg)
		}
	}

	const handleDelete = async (template: ITemplate) => {
		if (!workspace) return
		if (!confirm(`Delete template "${template.name}"?`)) return

		const res = await apiClient.del(
			`/api/v1/workspaces/${workspace.id}/templates/${template.id}`,
		)

		if (res.success) {
			toast.success("Template deleted")
			await fetchTemplates()
		} else {
			toast.error(res.error?.message || "Failed to delete template")
		}
	}

	const handlePreview = async (template: ITemplate) => {
		if (!workspace) return
		setPreviewTemplate(template)
		setPreviewLoading(true)

		const emailBody = template.channels.email?.htmlBody || template.channels.inapp?.body || "No previewable content"
		const res = await apiClient.post<{ html: string }>(
			`/api/v1/workspaces/${workspace.id}/templates/preview`,
			{
				content: emailBody,
				payload: {
					subscriber: { attributes: { name: "Jane Doe" } },
					user: { name: "Jane Doe" },
					orderId: "ORD-9982",
				},
			},
		)
		setPreviewLoading(false)

		if (res.success && res.data) {
			setPreviewHtml(res.data.html)
		} else {
			setPreviewHtml(emailBody)
		}
	}

	const openCreateModal = () => {
		setEditingTemplate(null)
		setIsFormOpen(true)
	}

	const openEditModal = (tpl: ITemplate) => {
		setEditingTemplate(tpl)
		setIsFormOpen(true)
	}

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<h1 className="dashboard-title">
						Templates
					</h1>
					<p className="dashboard-subtitle">
						Reusable multi-channel content definitions for event-driven workflows.
					</p>
				</div>
				<Button variant="primary" onClick={openCreateModal}>
					<Plus size={16} />
					<span>New Template</span>
				</Button>
				</header>

			{loading ? (
				<div className={styles.grid}>
					<Skeleton height={180} />
					<Skeleton height={180} />
					<Skeleton height={180} />
				</div>
			) : templates.length === 0 ? (
				<EmptyState
					title="No notification templates"
					description="Create a template to define your email, in-app, or webhook messages."
					icon={<FileText size={32} />}
				/>
			) : (
				<div className={styles.grid}>
					{templates.map((template) => {
						const channelsList = Object.keys(template.channels || {})
						return (
							<article key={template.id} className={styles.card}>
								<div>
									<div className={styles.cardHeader}>
										<h2 className={styles.templateName}>
											{template.name}
										</h2>
										<div className={styles.cardActions}>
											<button
												type="button"
												onClick={() => handlePreview(template)}
												className={styles.iconButton}
												aria-label={`Preview ${template.name}`}
											>
												<Eye size={16} aria-hidden="true" />
											</button>
											<button
												type="button"
												onClick={() => openEditModal(template)}
												className={styles.iconButton}
												aria-label={`Edit ${template.name}`}
											>
												<Edit2 size={16} aria-hidden="true" />
											</button>
											<button
												type="button"
												onClick={() => handleDelete(template)}
												className={`${styles.iconButton} ${styles.deleteButton}`}
												aria-label={`Delete ${template.name}`}
											>
												<Trash2 size={16} aria-hidden="true" />
											</button>
										</div>
									</div>

									{template.description && (
										<p className={styles.description}>
											{template.description}
										</p>
									)}

									<div className={styles.channels}>
										{channelsList.length === 0 ? (
											<span className={styles.noChannels}>No active channels</span>
										) : (
											channelsList.map((ch) => (
													<span key={ch} className={styles.channel}>
													{ch}
												</span>
											))
										)}
									</div>
								</div>

								<div className={styles.cardFooter}>
									<div className={`${styles.status} ${template.isActive ? styles.statusActive : styles.statusInactive}`}>
										{template.isActive ? (
											<>
												<CheckCircle size={14} aria-hidden="true" />
												<span>Active</span>
											</>
										) : (
											<>
												<XCircle size={14} aria-hidden="true" />
												<span>Inactive</span>
											</>
										)}
									</div>
									<span className={styles.updated}>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
								</div>
							</article>
						)
					})}
				</div>
			)}

			{isFormOpen && (
				<TemplateForm
					isOpen={isFormOpen}
					onClose={() => {
						setIsFormOpen(false)
						setEditingTemplate(null)
					}}
					onSubmit={handleCreateOrUpdate}
					initialData={editingTemplate}
				/>
			)}

			{previewTemplate && (
				<Modal
					isOpen={!!previewTemplate}
					onClose={() => {
						setPreviewTemplate(null)
						setPreviewHtml("")
					}}
					title={`Preview: ${previewTemplate.name}`}
				>
					{previewLoading ? (
						<p className={styles.previewLoading}>Rendering preview...</p>
					) : (
						<div
							className={styles.preview}
							dangerouslySetInnerHTML={{ __html: previewHtml }}
						/>
					)}
				</Modal>
			)}
		</div>
	)
}
