export interface IWorkspace {
	id: string
	name: string
	slug: string
	settings: JsonObject
	createdAt: string
	updatedAt: string
	role: "OWNER" | "ADMIN" | "MEMBER"
}

export interface IWorkspaceMember {
	id: string
	userId: string
	workspaceId: string
	role: "OWNER" | "ADMIN" | "MEMBER"
	createdAt: string
	user?: { email: string; name?: string }
}

export interface IApiKey {
	id: string
	workspaceId: string
	name: string
	prefix: string
	permissions?: string[] | null
	isActive: boolean
	lastUsedAt: string | null
	expiresAt: string | null
	createdAt: string
}

export interface IEmailProviderConfig {
	provider: string
	apiKey: string
	fromAddress: string
}

export interface IProviderConfig {
	id: string
	workspaceId: string
	channel: string
	provider: string
	config: JsonObject
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface ISubscriber {
	id: string
	workspaceId: string
	externalId: string
	email?: string | null
	name?: string | null
	timezone: string
	locale: string
	attributes: JsonObject
	preferences: SubscriberPreferences
	createdAt: string
	updatedAt: string
}

export interface IEmailChannel {
	subject: string
	htmlBody: string
	textBody?: string
}

/** In-app notification channel content. */
export interface IInAppChannel {
	title: string
	body: string
	actionUrl?: string
	avatarUrl?: string
}

/** Webhook channel content (stringified JSON payload). */
export interface IWebhookChannel {
	payload: string
}

/** Multi-channel content map attached to a template. */
export interface ITemplateChannels {
	email?: IEmailChannel
	inapp?: IInAppChannel
	webhook?: IWebhookChannel
}

/** Optional digest configuration for batching notifications. */
export interface IDigestConfig {
	window: string
}

/** A notification template – defines the content sent on each channel. */
export interface ITemplate {
	id: string
	workspaceId: string
	name: string
	description?: string | null
	channels: ITemplateChannels
	digestConfig?: IDigestConfig | null
	aiPersonalize?: boolean
	isActive: boolean
	createdAt: string
	updatedAt: string
}

/* -------------------------------------------------------------------------- */
/*  Routing Rule                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A routing rule that determines how/when a notification is delivered.
 * Rules are evaluated in `priority` order (lower = higher precedence).
 */
export interface IRoutingRule {
	id: string
	workspaceId: string
	name: string
	naturalLanguage?: string | null
	ruleAst: JsonObject
	priority: number
	isActive: boolean
	createdAt: string
	updatedAt: string
}

/* -------------------------------------------------------------------------- */
/*  Notification                                                               */
/* -------------------------------------------------------------------------- */

export type NotificationStatus =
	| "PENDING"
	| "ENQUEUED"
	| "PARTIAL"
	| "DELIVERED"
	| "FAILED"
export type DeliveryStatus =
	| "PENDING"
	| "RUNNING"
	| "SUCCESS"
	| "FAILED"
	| "DLQ"
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH"

export interface IDeliveryAttempt {
	id: string
	notificationId: string
	channel: string
	attemptNumber: number
	status: DeliveryStatus
	provider?: string | null
	providerMessageId?: string | null
	errorMessage?: string | null
	enqueuedAt?: string | null
	startedAt?: string | null
	finishedAt?: string | null
	durationMs?: number | null
}

export interface INotification {
	id: string
	workspaceId: string
	templateId: string
	subscriberId: string
	idempotencyKey: string
	triggerPayload: JsonObject
	channels: string[]
	status: NotificationStatus
	priority: NotificationPriority
	scheduledAt?: string | null
	triggeredAt: string
	createdAt: string
	readAt?: string | null
	template?: { name: string }
	subscriber?: {
		name?: string | null
		email?: string | null
		externalId: string
	}
	deliveryAttempts?: IDeliveryAttempt[]
	deliveries?: Array<{
		id: string
		channel: string
		status: DeliveryStatus
		provider?: string | null
		lastError?: string | null
	}>
}

/* -------------------------------------------------------------------------- */
/*  API Response Wrapper                                                      */
/* -------------------------------------------------------------------------- */

export interface IApiMeta {
	requestId?: string
	cursor?: string | null
	hasMore?: boolean
	total?: number
	page?: number
	limit?: number
	[key: string]: unknown
}

export interface IApiError {
	code: string
	message: string
	status?: number
	details?: Record<string, string[]> | unknown
}

/**
 * Canonical envelope for every API response.
 * @typeParam T - The shape of the `data` payload on success.
 */
export interface ApiSuccess<T> {
	success: true
	data: T
	meta: IApiMeta
}

export interface ApiFailure {
	success: false
	error: IApiError
	meta: IApiMeta
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export interface IUser {
	id: string
	email: string
	name?: string | null
	emailVerified?: boolean
}

export interface IAuthResponse {
	accessToken: string
	user: IUser
}

export type ChannelVariant = "email" | "inapp" | "webhook"
export type SubscriberPreferences = JsonObject &
	Partial<Record<ChannelVariant, boolean>>

export interface PaginatedResponse<T> {
	items: T[]
	meta: Pick<IApiMeta, "cursor" | "hasMore" | "total" | "page" | "limit">
}

export interface IApiKeyCreateResponse extends IApiKey {
	fullKey: string
}

export interface INotificationTriggerResponse {
	notificationId: string
	status: NotificationStatus
	channels: string[]
	scheduledAt: string | null
}

export interface IAnalyticsOverview {
	totalSent: number
	delivered: number
	failed: number
	deliveryRate: number
	openRate: number
	clickRate: number
	byChannel: Record<string, {
		sent: number
		delivered: number
		failed: number
		deliveryRate: number
	}>
}

export interface IAnalyticsChannel {
	channel: string
	sent: number
	delivered: number
	failed: number
	avgDurationMs: number | null
}

export interface IAnalyticsTimelinePoint {
	timestamp: string
	sent: number
	delivered: number
	failed: number
}

export interface SubscriberUpsertInput {
	externalId: string
	email?: string
	name?: string
	timezone: string
	locale: string
	attributes: JsonObject
	preferences: SubscriberPreferences
}

export interface TemplateUpsertInput {
	name: string
	description?: string
	channels: ITemplateChannels
	aiPersonalize: boolean
	isActive: boolean
}

export interface TriggerNotificationInput {
	templateId: string
	subscriberExternalId: string
	payload: JsonObject
	options?: {
		smartTiming?: boolean
		channels?: string[]
	}
}

/* -------------------------------------------------------------------------- */
/*  Notification Trigger                                                      */
/* -------------------------------------------------------------------------- */

export interface ITriggerOptions {
	smartTiming?: boolean
	channels?: string[]
	scheduledAt?: string
	priority?: NotificationPriority
}

export interface ITriggerPayload {
	templateId: string
	subscriberExternalId: string
	payload: Record<string, unknown>
	options?: ITriggerOptions
}

/* -------------------------------------------------------------------------- */
/*  WebSocket Messages                                                        */
/* -------------------------------------------------------------------------- */

export interface IWSNotification {
	id: string
	title: string
	body: string
	actionUrl?: string
	avatarUrl?: string
	timestamp?: string
	readAt?: string | null
}

export interface IWSMessage {
	type: "notification" | "pending_flush"
	data: IWSNotification | IWSNotification[]
}
import type { JsonObject } from "./json"
