import { createQueue } from "./queue.factory.ts"
import { QueueNames } from "./queue.constants.ts"

export type OutboxTickJob = { version: 1 }

export const outboxQueue = createQueue<OutboxTickJob>(QueueNames.OUTBOX)
