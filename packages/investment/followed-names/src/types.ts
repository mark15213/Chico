/**
 * Public type vocabulary of the followed-names registry: the record one
 * followed instrument carries and the errors the service raises.
 * @module @deepseek-ai/dsh-followed-names/src/types
 */

import type { InstrumentRef } from '@deepseek-ai/dsh-market-data'

/**
 * One instrument the user has followed at some point. Unfollowing clears
 * {@link FollowedName.followed} rather than deleting the record, so notes,
 * insights, and session associations survive and re-following restores them.
 */
export interface FollowedName {
  /** The instrument this record describes. */
  readonly instrument: InstrumentRef
  /** Display name as the user should see it, in the venue's own language. */
  readonly displayName: string
  /** Whether the name is currently on the watchlist. */
  readonly followed: boolean
  /** ISO-8601 instant of the first follow; never rewritten by a later re-follow. */
  readonly firstFollowedAt: string
  /** ISO-8601 instant of the last follow or unfollow. */
  readonly updatedAt: string
}

/** Reasons the followed-names service refuses a request. */
export type FollowedNameErrorCode =
  | 'FOLLOWED_NAME_UNKNOWN'
  | 'FOLLOWED_NAME_INVALID_DISPLAY_NAME'

/** Error thrown by the followed-names service. */
export class FollowedNameError extends Error {
  /**
   * @param message - human-readable cause.
   * @param code - the machine-readable reason.
   */
  constructor(message: string, readonly code: FollowedNameErrorCode) {
    super(message)
    this.name = 'FollowedNameError'
  }
}
