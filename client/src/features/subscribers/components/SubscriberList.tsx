"use client"

import { useCallback, useEffect, useState } from "react"
import { Edit2, Plus, Search, Trash2, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/shared/api/api"
import { useAuth } from "@/shared/auth/auth-context"
import { Button } from "@/components/ui/Button/Button"
import { Skeleton } from "@/components/ui/Skeleton/Skeleton"
import { EmptyState } from "@/components/ui/EmptyState/EmptyState"
import { SubscriberForm } from "./SubscriberForm"
import type { ISubscriber, SubscriberUpsertInput } from "@/shared/types/domain"

export function SubscriberList() {
	const { workspace } = useAuth()
	const [subscribers, setSubscribers] = useState<ISubscriber[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState("")

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [editingSubscriber, setEditingSubscriber] = useState<ISubscriber | null>(null)

	const fetchSubscribers = useCallback(async () => {
		if (!workspace) return
		setLoading(true)

		const res = await apiClient.get<ISubscriber[]>(
			`/api/v1/workspaces/${workspace.id}/subscribers`,
			{ params: { limit: 50, search: searchQuery || undefined } },
		)

		if (!res.success) {
			toast.error(res.error?.message || "Failed to load subscribers")
			setSubscribers([])
			setTotal(0)
		} else if (res.data) {
			setSubscribers(res.data)
			setTotal(res.meta?.total || res.data.length)
		}

		setLoading(false)
	}, [workspace, searchQuery])

	useEffect(() => {
		fetchSubscribers()
	}, [fetchSubscribers])

	const handleCreateOrUpdate = async (data: SubscriberUpsertInput) => {
		if (!workspace) return

		const res = await apiClient.post<ISubscriber>(
			`/api/v1/workspaces/${workspace.id}/subscribers`,
			data,
		)

		if (res.success) {
			toast.success(editingSubscriber ? "Subscriber updated" : "Subscriber added")
			setIsModalOpen(false)
			setEditingSubscriber(null)
			await fetchSubscribers()
		} else {
			const errMsg = res.error?.message || "Operation failed"
			toast.error(errMsg)
			throw new Error(errMsg)
		}
	}

	const handleDelete = async (subscriber: ISubscriber) => {
		if (!workspace) return
		if (!confirm(`Delete subscriber "${subscriber.externalId}"?`)) return

		const res = await apiClient.del(
			`/api/v1/workspaces/${workspace.id}/subscribers/${subscriber.id}`,
		)

		if (res.success) {
			toast.success("Subscriber deleted")
			await fetchSubscribers()
		} else {
			toast.error(res.error?.message || "Failed to delete subscriber")
		}
	}

	const openCreateModal = () => {
		setEditingSubscriber(null)
		setIsModalOpen(true)
	}

	const openEditModal = (sub: ISubscriber) => {
		setEditingSubscriber(sub)
		setIsModalOpen(true)
	}

	return (
		<div className="dashboard-page" style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
			<div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
				<div>
					<h1 className="dashboard-title" style={{ fontSize: "1.75rem", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
						Subscribers
						<span style={{ fontSize: "0.875rem", padding: "2px 10px", background: "#334155", borderRadius: "9999px", color: "#38bdf8", marginLeft: "12px", verticalAlign: "middle" }}>
							{total}
						</span>
					</h1>
					<p className="dashboard-subtitle" style={{ color: "#94a3b8", fontSize: "0.875rem", marginTop: "0.25rem" }}>
						Profiles available for targeting, channel delivery preferences, and runtime triggers.
					</p>
				</div>
				<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
					<label style={{ position: "relative", width: 280, maxWidth: "100%" }}>
						<Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by ID or email..."
							style={{
								width: "100%",
								padding: "8px 12px 8px 38px",
								backgroundColor: "#1e293b",
								border: "1px solid #334155",
								borderRadius: "0.375rem",
								color: "#f8fafc",
								fontSize: "0.875rem",
							}}
						/>
					</label>
					<Button variant="primary" onClick={openCreateModal}>
						<Plus size={16} />
						<span>Add Subscriber</span>
					</Button>
				</div>
			</div>

			{loading ? (
				<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
					<Skeleton height={60} />
					<Skeleton height={60} />
					<Skeleton height={60} />
				</div>
			) : subscribers.length === 0 ? (
				<EmptyState
					title="No subscribers found"
					description="Add a subscriber to start sending targeted multi-channel notifications."
					icon={<UserCheck size={32} />}
				/>
			) : (
				<div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", border: "1px solid #334155", overflow: "hidden" }}>
					<table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
						<thead>
							<tr style={{ borderBottom: "1px solid #334155", backgroundColor: "#0f172a", color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase" }}>
								<th style={{ padding: "12px 16px" }}>External ID</th>
								<th style={{ padding: "12px 16px" }}>Email</th>
								<th style={{ padding: "12px 16px" }}>Name</th>
								<th style={{ padding: "12px 16px" }}>Timezone / Locale</th>
								<th style={{ padding: "12px 16px" }}>Created</th>
								<th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{subscribers.map((subscriber) => (
								<tr key={subscriber.id} style={{ borderBottom: "1px solid #334155", color: "#cbd5e1", fontSize: "0.875rem" }}>
									<td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#f8fafc" }}>
										{subscriber.externalId}
									</td>
									<td style={{ padding: "12px 16px" }}>{subscriber.email || "—"}</td>
									<td style={{ padding: "12px 16px", color: "#f8fafc" }}>{subscriber.name || "—"}</td>
									<td style={{ padding: "12px 16px" }}>
										{subscriber.timezone} ({subscriber.locale})
									</td>
									<td style={{ padding: "12px 16px", color: "#64748b" }}>
										{new Date(subscriber.createdAt).toLocaleDateString()}
									</td>
									<td style={{ padding: "12px 16px", textAlign: "right" }}>
										<div style={{ display: "inline-flex", gap: "8px" }}>
											<button
												onClick={() => openEditModal(subscriber)}
												style={{ padding: "6px", background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
												title="Edit Subscriber"
											>
												<Edit2 size={16} />
											</button>
											<button
												onClick={() => handleDelete(subscriber)}
												style={{ padding: "6px", background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}
												title="Delete Subscriber"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{isModalOpen && (
				<SubscriberForm
					isOpen={isModalOpen}
					onClose={() => {
						setIsModalOpen(false)
						setEditingSubscriber(null)
					}}
					onSubmit={handleCreateOrUpdate}
					initialData={editingSubscriber}
				/>
			)}
		</div>
	)
}
