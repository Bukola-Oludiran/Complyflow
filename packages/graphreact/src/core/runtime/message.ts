/**
 * Message creation and TTL logic.
 */

import type { Message } from '../types.js';
import { DEFAULT_TTL } from './constants.js';

let messageCounter = 0;

export function createMessage(
  type: string,
  from: string,
  to: string,
  payload: unknown,
  ttl: number = DEFAULT_TTL
): Message {
  return {
    id: `msg_${++messageCounter}`,
    type,
    from,
    to,
    payload,
    ttl,
    timestamp: Date.now(),
  };
}

/**
 * Decrement TTL. Returns false if message should be dropped.
 */
export function decrementTTL(msg: Message): boolean {
  msg.ttl--;
  return msg.ttl > 0;
}

/** Reset the counter (for testing) */
export function resetMessageCounter(): void {
  messageCounter = 0;
}
