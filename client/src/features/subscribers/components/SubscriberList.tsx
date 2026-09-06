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
import styles from "./SubscriberList.module.css"

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
		const timer = window.setTimeout(() => void fetchSubscribers(), 0)
		return () => window.clearTimeout(timer)
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
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<h1 className="dashboard-title">
						Subscribers
						<span className={styles.count}>
							{total}
						</span>
					</h1>
					<p className="dashboard-subtitle">
						Profiles available for targeting, channel delivery preferences, and runtime triggers.
					</p>
				</div>
				<div className={styles.actions}>
					<label className={styles.searchWrap}>
						<Search size={16} className={styles.searchIcon} aria-hidden="true" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by ID or email..."
							aria-label="Search subscribers"
							className={styles.searchInput}
						/>
					</label>
					<Button variant="primary" onClick={openCreateModal}>
						<Plus size={16} />
						<span>Add Subscriber</span>
					</Button>
				</div>
			</header>

			{loading ? (
				<div className={styles.loadingList}>
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
				<div className={styles.tableCard}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>External ID</th>
								<th>Email</th>
								<th>Name</th>
								<th>Timezone / Locale</th>
								<th>Created</th>
								<th className={styles.actionsCell}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{subscribers.map((subscriber) => (
								<tr key={subscriber.id}>
									<td className={styles.externalId}>
										{subscriber.externalId}
									</td>
									<td>{subscriber.email || "—"}</td>
									<td className={styles.primaryText}>{subscriber.name || "—"}</td>
									<td>
										{subscriber.timezone} ({subscriber.locale})
									</td>
									<td className={styles.timestamp}>
										{new Date(subscriber.createdAt).toLocaleDateString()}
									</td>
									<td className={styles.actionsCell}>
										<div className={styles.rowActions}>
											<button
												type="button"
												onClick={() => openEditModal(subscriber)}
												className={styles.iconButton}
												aria-label={`Edit ${subscriber.externalId}`}
											>
												<Edit2 size={16} aria-hidden="true" />
											</button>
											<button
												type="button"
												onClick={() => handleDelete(subscriber)}
												className={`${styles.iconButton} ${styles.deleteButton}`}
												aria-label={`Delete ${subscriber.externalId}`}
											>
												<Trash2 size={16} aria-hidden="true" />
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
