// ============================================================================
// Varta – Shared Type Definitions
// ============================================================================
// Canonical TypeScript interfaces that mirror backend data models.
// MongoDB documents use `_id`; PostgreSQL/Prisma models use `id`.
// ============================================================================

/* -------------------------------------------------------------------------- */
/*  Workspace (MongoDB)                                                       */
/* -------------------------------------------------------------------------- */

/** Rate-limit configuration scoped to a single workspace. */
export interface IRateLimits {
  /** Maximum emails the workspace may send per hour. */
  emailPerHour: number;
  /** Maximum push notifications the workspace may send per hour. */
  pushPerHour: number;
}

/** Top-level workspace settings stored in MongoDB. */
export interface IWorkspaceSettings {
  /** IANA timezone used when the subscriber has no explicit preference. */
  defaultTimezone: string;
  /** Per-channel rate limits for outgoing notifications. */
  rateLimits: IRateLimits;
}

/** Email provider configuration. */
export interface IEmailProviderConfig {
  provider: string;
  apiKey: string;
  fromAddress: string;
}

/** Push-notification provider configuration (e.g. FCM). */
export interface IPushProviderConfig {
  provider: string;
  serviceAccountJson: string;
}

/** Outgoing webhook provider configuration. */
export interface IWebhookProviderConfig {
  provider: string;
  webhookUrl: string;
  webhookSecret: string;
}

/** Channel-level provider configurations attached to a workspace. */
export interface IProviderConfigs {
  email?: IEmailProviderConfig;
  push?: IPushProviderConfig;
  webhook?: IWebhookProviderConfig;
}

/** A hashed API key record stored alongside the workspace. */
export interface IApiKeyRecord {
  /** SHA-256 hash of the raw key – the plaintext is never persisted. */
  keyHash: string;
  /** Human-readable label for the key (e.g. "Production Backend"). */
  label: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/**
 * A Varta workspace – the top-level organisational unit.
 *
 * Stored in MongoDB. Every subscriber, template, and routing rule belongs
 * to exactly one workspace identified by its `_id`.
 */
export interface IWorkspace {
  _id: string;
  tenantId: string;
  name: string;
  settings: IWorkspaceSettings;
  providerConfigs?: IProviderConfigs;
  apiKeys: IApiKeyRecord[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Subscriber (PostgreSQL / Prisma)                                          */
/* -------------------------------------------------------------------------- */

/**
 * A notification subscriber – the person (or device) who receives messages.
 *
 * Stored in PostgreSQL via Prisma. Identified by a composite key of
 * `workspaceId` + `externalId`.
 */
export interface ISubscriber {
  id: string;
  workspaceId: string;
  /** Caller-provided unique ID (e.g. your own user-id). */
  externalId: string;
  email?: string;
  phone?: string;
  pushToken?: string;
  /** IANA timezone for smart-timing delivery. */
  timezone: string;
  /** BCP-47 locale tag (e.g. "en-US"). */
  locale: string;
  /** Arbitrary key-value metadata for template interpolation / segmentation. */
  attributes: Record<string, unknown>;
  /** Per-channel opt-in/opt-out map (e.g. `{ email: true, push: false }`). */
  channelPreferences: Record<string, boolean>;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Template (MongoDB)                                                        */
/* -------------------------------------------------------------------------- */

/** Email channel content within a template. */
export interface IEmailChannel {
  subject: string;
  /** Handlebars/Liquid HTML body. */
  htmlBody: string;
}

/** In-app notification channel content. */
export interface IInAppChannel {
  title: string;
  body: string;
  actionUrl?: string;
  avatarUrl?: string;
}

/** Push-notification channel content. */
export interface IPushChannel {
  title: string;
  body: string;
}

/** Webhook channel content (stringified JSON payload). */
export interface IWebhookChannel {
  payload: string;
}

/** Multi-channel content map attached to a template. */
export interface ITemplateChannels {
  email?: IEmailChannel;
  inapp?: IInAppChannel;
  push?: IPushChannel;
  webhook?: IWebhookChannel;
}

/** Optional digest configuration for batching notifications. */
export interface IDigestConfig {
  /** ISO-8601 duration string (e.g. "PT5M" for 5 minutes). */
  window: string;
}

/**
 * A notification template – defines the content sent on each channel.
 *
 * Stored in MongoDB. Referenced by name when triggering notifications.
 */
export interface ITemplate {
  _id: string;
  workspaceId: string;
  /** Unique (within workspace) human-readable identifier. */
  name: string;
  channels: ITemplateChannels;
  /** Whether this template is eligible for use. */
  active: boolean;
  /** If set, notifications are batched within the digest window before delivery. */
  digestConfig?: IDigestConfig;
  /** When true the AI personalisation pipeline will rewrite content per-subscriber. */
  aiPersonalize?: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  Routing Rule (PostgreSQL / Prisma)                                        */
/* -------------------------------------------------------------------------- */

/**
 * A routing rule that determines how/when a notification is delivered.
 *
 * Rules are evaluated in `priority` order (lower = higher precedence).
 * The `ruleAst` is compiled from `naturalLanguage` by the AI rule engine.
 */
export interface IRoutingRule {
  id: string;
  workspaceId: string;
  name: string;
  /** Plain-English rule description entered by the user. */
  naturalLanguage: string;
  /** Machine-readable AST generated from `naturalLanguage`. */
  ruleAst: Record<string, unknown>;
  /** Evaluation order – lower values take precedence. */
  priority: number;
  active: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*  API Response Wrapper                                                      */
/* -------------------------------------------------------------------------- */

/** Structured error payload returned by the API on failure. */
export interface IApiError {
  message: string;
  status: number;
  /** Stack trace – only present in non-production environments. */
  stack?: string;
}

/**
 * Canonical envelope for every API response.
 *
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

/** Minimal user representation returned after authentication. */
export interface IUser {
  id: string;
  email: string;
}

/** Response payload for login / signup endpoints. */
export interface IAuthResponse {
  token: string;
  user: IUser;
}

/* -------------------------------------------------------------------------- */
/*  Notification Trigger                                                      */
/* -------------------------------------------------------------------------- */

/** Options that modify delivery behaviour for a single trigger. */
export interface ITriggerOptions {
  /** Use ML-predicted optimal send time for the subscriber. */
  smartTiming?: boolean;
  /** Restrict delivery to these channels only (e.g. `["email", "push"]`). */
  channels?: string[];
}

/**
 * Payload sent to `POST /api/trigger` to fire a notification.
 */
export interface ITriggerPayload {
  /** Name of the template to render. */
  templateName: string;
  /** External subscriber ID that will receive the notification. */
  subscriberId: string;
  /** Dynamic data interpolated into the template at render time. */
  payload: Record<string, unknown>;
  options?: ITriggerOptions;
}

/* -------------------------------------------------------------------------- */
/*  WebSocket Messages                                                        */
/* -------------------------------------------------------------------------- */

/** A single in-app notification delivered over WebSocket. */
export interface IWSNotification {
  title: string;
  body: string;
  actionUrl?: string;
  avatarUrl?: string;
  /** ISO-8601 timestamp when the notification was created. */
  timestamp?: string;
}

/**
 * Typed WebSocket frame received by the client.
 *
 * - `notification`  – a single real-time notification.
 * - `pending_flush` – a batch of notifications that were queued while the
 *                     subscriber was offline.
 */
export interface IWSMessage {
  type: 'notification' | 'pending_flush';
  data: IWSNotification | IWSNotification[];
}
