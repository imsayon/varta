// ============================================================================
// Varta – Shared Type Definitions
// ============================================================================
// Canonical TypeScript interfaces that mirror the PostgreSQL/Prisma data models
// on the backend. All entities use `id` (UUID) as their primary key.
// ============================================================================

/* -------------------------------------------------------------------------- */
/*  Workspace                                                                  */
/* -------------------------------------------------------------------------- */

/** A Varta workspace – the top-level organisational unit. */
export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
  settings: JsonObject;
  createdAt: string;
  updatedAt: string;
}

/** A workspace membership entry. */
export interface IWorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
  user?: { email: string; name?: string };
}

/* -------------------------------------------------------------------------- */
/*  API Keys                                                                   */
/* -------------------------------------------------------------------------- */

/** An API key record (the plaintext key is only shown once on creation). */
export interface IApiKey {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  permissions?: JsonObject | null;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Provider Config                                                            */
/* -------------------------------------------------------------------------- */

/** Email provider configuration. */
export interface IEmailProviderConfig {
  provider: string;
  apiKey: string;
  fromAddress: string;
}

/** Channel-level provider configuration stored per workspace. */
export interface IProviderConfig {
  id: string;
  workspaceId: string;
  channel: string;
  provider: string;
  config: JsonObject;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Subscriber                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A notification subscriber – the person (or device) who receives messages.
 * Identified by a composite key of `workspaceId` + `externalId`.
 */
export interface ISubscriber {
  id: string;
  workspaceId: string;
  externalId: string;
  email?: string | null;
  name?: string | null;
  timezone: string;
  locale: string;
  attributes: JsonObject;
  preferences: SubscriberPreferences;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Template                                                                   */
/* -------------------------------------------------------------------------- */

/** Email channel content within a template. */
export interface IEmailChannel {
  subject: string;
  htmlBody: string;
  textBody?: string;
}

/** In-app notification channel content. */
export interface IInAppChannel {
  title: string;
  body: string;
  actionUrl?: string;
  avatarUrl?: string;
}

/** Webhook channel content (stringified JSON payload). */
export interface IWebhookChannel {
  payload: string;
}

/** Multi-channel content map attached to a template. */
export interface ITemplateChannels {
  email?: IEmailChannel;
  inapp?: IInAppChannel;
  webhook?: IWebhookChannel;
}

/** Optional digest configuration for batching notifications. */
export interface IDigestConfig {
  window: string;
}

/** A notification template – defines the content sent on each channel. */
export interface ITemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  channels: ITemplateChannels;
  digestConfig?: IDigestConfig | null;
  aiPersonalize?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Routing Rule                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A routing rule that determines how/when a notification is delivered.
 * Rules are evaluated in `priority` order (lower = higher precedence).
 */
export interface IRoutingRule {
  id: string;
  workspaceId: string;
  name: string;
  naturalLanguage?: string | null;
  ruleAst: JsonObject;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Notification                                                               */
/* -------------------------------------------------------------------------- */

export type NotificationStatus = 'PENDING' | 'ENQUEUED' | 'PARTIAL' | 'DELIVERED' | 'FAILED';
export type DeliveryStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'DLQ';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface IDeliveryAttempt {
  id: string;
  notificationId: string;
  channel: string;
  attemptNumber: number;
  status: DeliveryStatus;
  provider?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  enqueuedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
}

export interface INotification {
  id: string;
  workspaceId: string;
  templateId: string;
  subscriberId: string;
  idempotencyKey: string;
  triggerPayload: JsonObject;
  channels: string[];
  status: NotificationStatus;
  priority: NotificationPriority;
  scheduledAt?: string | null;
  triggeredAt: string;
  createdAt: string;
  template?: { name: string };
  subscriber?: { name?: string | null; email?: string | null; externalId: string };
  deliveryAttempts?: IDeliveryAttempt[];
}

/* -------------------------------------------------------------------------- */
/*  API Response Wrapper                                                      */
/* -------------------------------------------------------------------------- */

export interface IApiError {
  message: string;
  status: number;
  stack?: string;
}

/**
 * Canonical envelope for every API response.
 * @typeParam T - The shape of the `data` payload on success.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: IApiError;
}

/* -------------------------------------------------------------------------- */
/*  Auth                                                                      */
/* -------------------------------------------------------------------------- */

export interface IUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
}

export interface IAuthResponse {
  accessToken: string;
  user: IUser;
}

export type ChannelVariant = 'email' | 'inapp' | 'push' | 'webhook';
export type SubscriberPreferences = JsonObject & Partial<Record<ChannelVariant, boolean>>;

export interface PaginatedResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

export interface ISubscriberListData {
  subscribers: ISubscriber[];
  page: number;
  limit: number;
  total: number;
}

export interface ITemplateListData {
  templates: ITemplate[];
  page: number;
  limit: number;
  total: number;
}

export interface INotificationListData {
  notifications: INotification[];
  page: number;
  limit: number;
  total: number;
}

export interface IApiKeyCreateResponse extends IApiKey {
  fullKey: string;
}

export interface INotificationTriggerResponse {
  notificationId: string;
  status: NotificationStatus;
  channels: string[];
  scheduledAt: string | null;
}

export interface SubscriberUpsertInput {
  externalId: string;
  email?: string;
  name?: string;
  timezone: string;
  locale: string;
  attributes: JsonObject;
  preferences: SubscriberPreferences;
}

export interface TemplateUpsertInput {
  name: string;
  description?: string;
  channels: ITemplateChannels;
  aiPersonalize: boolean;
  isActive: boolean;
}

export interface TriggerNotificationInput {
  templateId: string;
  subscriberExternalId: string;
  payload: JsonObject;
  options?: {
    smartTiming?: boolean;
  };
}

/* -------------------------------------------------------------------------- */
/*  Notification Trigger                                                      */
/* -------------------------------------------------------------------------- */

export interface ITriggerOptions {
  smartTiming?: boolean;
  channels?: string[];
  scheduledAt?: string;
  priority?: NotificationPriority;
}

export interface ITriggerPayload {
  templateId: string;
  subscriberExternalId: string;
  payload: Record<string, unknown>;
  options?: ITriggerOptions;
}

/* -------------------------------------------------------------------------- */
/*  WebSocket Messages                                                        */
/* -------------------------------------------------------------------------- */

export interface IWSNotification {
  title: string;
  body: string;
  actionUrl?: string;
  avatarUrl?: string;
  timestamp?: string;
}

export interface IWSMessage {
  type: 'notification' | 'pending_flush';
  data: IWSNotification | IWSNotification[];
}
import type { JsonObject } from './json';
