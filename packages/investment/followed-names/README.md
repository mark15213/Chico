# @deepseek-ai/dsh-followed-names

English | [中文](README.zh.md)

Followed-names registry (`ctx.followedNames`) for the DeepSeek Harness: the durable record of every instrument the user has followed, plus the archive directory Chico's own work lives in.

## Unfollowing keeps the record

`unfollow` clears a flag; it does not delete anything. Notes, insights, and session associations survive, and re-following restores them along with the original `firstFollowedAt` — the record's age is the first follow, not the latest one. Unfollowing an already-unfollowed name resolves without restamping, so a repeated action is not an error and not a write.

There is no delete. That matches the harness's own stance rather than inventing an exception: sessions can be archived but not deleted, and deleting a workspace registration deliberately leaves its directory and logs alone.

Records are keyed by instrument identity (`MARKET:SYMBOL`), not by a generated id, because the instrument *is* the identity. Following the same listing twice renames in place; the same code on two venues is two records.

## The archive directory

One directory holds Chico's own work — notes, models, research output — and every Chico session runs with it as cwd, so produced files land somewhere durable and the existing produced-files surface lists and links them unchanged.

`archivePath` defaults under the harness home (`chico/archive`), beside `sessions` and `storages`, because the harness keeps all user data under one root. A deployment that wants the directory visible or synced points the config elsewhere; a relative path is refused rather than resolved against an ambient working directory.

**The directory is deliberately never registered as a Workspace.** The workspace registry adopts historical sessions only during its one-time bootstrap, after which later cwd-only sessions remain Ungrouped. An unregistered directory therefore produces no workspace row at all, which is what keeps a user from ever seeing a workspace they did not create — with no hiding mechanism and no durable format change.

## Time is a parameter

`follow` and `unfollow` take the instant to stamp rather than reading a clock. A registry that stamped its own records could not be asserted against a fixed expectation, and every caller already knows what time it means.

## Model Experience

None, as the registry stores product state behind `ctx.followedNames`; it registers no tools, injects no prompts, and writes no session events. A consumer that renders a watchlist to a model owns that surface.

#### KV Cache effect

None; the package never touches a request prefix.

## Known Limitations and Deferred Work

- **No way to reach an unfollowed name from the product yet.** The record survives, but nothing lists it: a name taken off the watchlist is currently unreachable through any surface. A "all names" view or a search over records is required before unfollowing is safe to expose.
- **No association between a session and a name.** The record carries no session ids, so "conversations about this name" cannot be answered yet; that association is its own decision about where it lives.
- **The archive is one directory with no internal convention.** Nothing yet says where a name's notes go inside it, so two consumers could choose different layouts.
