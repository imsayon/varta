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
		<div className="dashboard-page" style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
			<div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
				<div>
					<h1 className="dashboard-title" style={{ fontSize: "1.75rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
						Templates
					</h1>
					<p className="dashboard-subtitle" style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: "0.25rem" }}>
						Reusable multi-channel content definitions for event-driven workflows.
					</p>
				</div>
				<Button variant="primary" onClick={openCreateModal}>
					<Plus size={16} />
					<span>New Template</span>
				</Button>
			</div>

			{loading ? (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
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
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
					{templates.map((template) => {
						const channelsList = Object.keys(template.channels || {})
						return (
							<div
								key={template.id}
								style={{
									backgroundColor: "#1e293b",
									borderRadius: "0.5rem",
									border: "1px solid #334155",
									padding: "1.25rem",
									display: "flex",
									flexDirection: "column",
									justifyContent: "space-between",
									gap: "1rem",
								}}
							>
								<div>
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
										<h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
											{template.name}
										</h3>
										<div style={{ display: "flex", gap: "6px" }}>
											<button
												onClick={() => handlePreview(template)}
												style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
												title="Preview rendered template"
											>
												<Eye size={16} />
											</button>
											<button
												onClick={() => openEditModal(template)}
												style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
												title="Edit Template"
											>
												<Edit2 size={16} />
											</button>
											<button
												onClick={() => handleDelete(template)}
												style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
												title="Delete Template"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</div>

									{template.description && (
										<p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: "0 0 0.75rem 0" }}>
											{template.description}
										</p>
									)}

									<div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "0.75rem" }}>
										{channelsList.length === 0 ? (
											<span style={{ fontSize: "0.75rem", color: "#64748b" }}>No active channels</span>
										) : (
											channelsList.map((ch) => (
												<span
													key={ch}
													style={{
														fontSize: "0.75rem",
														padding: "2px 8px",
														backgroundColor: "#0f172a",
														border: "1px solid #334155",
														borderRadius: "0.25rem",
														color: "#38bdf8",
														textTransform: "uppercase",
														fontWeight: 500,
													}}
												>
													{ch}
												</span>
											))
										)}
									</div>
								</div>

								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid #334155", fontSize: "0.75rem", color: "#64748b" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
										{template.isActive ? (
											<>
												<CheckCircle size={14} style={{ color: "#10b981" }} />
												<span style={{ color: "#10b981" }}>Active</span>
											</>
										) : (
											<>
												<XCircle size={14} style={{ color: "#ef4444" }} />
												<span style={{ color: "#ef4444" }}>Inactive</span>
											</>
										)}
									</div>
									<span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
								</div>
							</div>
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
						<p style={{ color: "#94a3b8" }}>Rendering preview...</p>
					) : (
						<div
							style={{
								padding: "1rem",
								backgroundColor: "#0f172a",
								borderRadius: "0.375rem",
								border: "1px solid #334155",
								maxHeight: "400px",
								overflowY: "auto",
								color: "#f8fafc",
							}}
							dangerouslySetInnerHTML={{ __html: previewHtml }}
						/>
					)}
				</Modal>
			)}
		</div>
	)
}
