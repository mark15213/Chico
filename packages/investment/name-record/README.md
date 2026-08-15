# @deepseek-ai/dsh-name-record

English | [中文](README.zh.md)

Name record (`ctx.nameRecord`) for the DeepSeek Harness: everything the user has said and done about one instrument — the stance they hold, the decision chain behind it, and the conversations bound to it.

## The record does not depend on the watchlist

A user can open any instrument, write a thesis, and decide about following it later. Tying the record to the [follow flag](../followed-names/README.md) would make "let me look at this first" impossible, and would delete a considered judgement the moment someone tidied their watchlist.

The two are keyed the same way (`MARKET:SYMBOL`), so a name's record and its follow flag are addressable by one identity without a join.

## Four kinds, one chain

A **thesis** is what the user believes. A **decision** is what they did, including deciding not to act. An **event** is what happened to the instrument. A **verification** is how a thesis turned out.

The kinds are closed because each answers a different question and every surface switches on them. Entries read newest first; they are stored oldest first so appending never rewrites the array's head.

**Verification is why the chain exists.** Theses and decisions are recorded elsewhere in the industry; hanging a thesis open, coming back when it can be settled, and storing *how long that took* is calibration. `elapsedDays` is stored rather than derived, because it is the calibration figure and must not change when an entry is re-read.

A verification is the only write that touches an entry already stored: it settles exactly one open thesis and the verdict lands on both, so the chain agrees with itself whichever end is read. A thesis is answered once — a second verification is refused rather than allowed to overwrite the first.

## Provenance is required

Every entry says where it came from: `manual` when the user wrote it, or the session and turn when it came from a conversation. A record that cannot say where it came from gives the user no reason to trust it, and the whole point of the chain is that it is auditable.

## Every figure in the stance is entered by hand

`posture` (holding / watching / avoiding), `positionPercent`, and `conviction` are all the user's. The harness has no broker connection, and a position the product guessed would be worse than one it does not claim to know. A position outside 0–100 is refused.

`setStance` leaves absent fields as they are, so a surface that edits one figure does not restate the others; `null` clears a figure explicitly. Opening a name defaults to `watching`, because opening a name is not holding it.

## Time is a parameter

`append` and `setStance` take the instant to stamp rather than reading a clock, so the calibration figures stay reproducible under test. `bindSession` takes none: it records membership, not a moment.

## Model Experience

None, as the record stores product state behind `ctx.nameRecord`; it registers no tools, injects no prompts, and writes no session events. A consumer that puts a name's record in front of a model owns that surface.

#### KV Cache effect

None; the package never touches a request prefix.

## Known Limitations and Deferred Work

- **Nothing extracts entries from a conversation yet.** Every entry is written by an explicit call, so in practice the user writes all of them. Automatic extraction is the memory system's design; this package holds the shape it will write into and the provenance it will fill.
- **Entries cannot be edited or removed.** A chain is append-only, which is right for an audit trail but leaves a typo permanent. Correction needs its own decision about whether a superseding entry or a real edit is the honest model.
- **An event carries no attribution.** The workbench design splits a move into market, sector, and name-specific parts; that split needs data this package does not have, so an event is prose until an attribution seam exists.
- **Session binding is one-way.** A name lists its sessions, but a session does not know its name, so a conversation opened from the session list cannot show which instrument it belongs to.
