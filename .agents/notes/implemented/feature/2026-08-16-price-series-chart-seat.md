# Agent Note: The price-series chart seat, and Chico's workbench chart

Status: implemented

English | [中文](2026-08-16-price-series-chart-seat.zh.md)

## Problem

The shipped price-series card draws candles and nothing else: no axes, no crosshair, no volume, no indicators. A reader can see a shape but cannot name a session, place a price, or judge whether a move carried volume. Chico is an investment workbench, so its users need the chart a trading platform gives them.

Making the shipped chart into that chart was not an option. The same card renders in every composition, including conversations about codebases, where an indicator panel and a session readout are noise. So the workbench chart has to reach only investing work, and the harness chart has to stay exactly as it is everywhere else.

Two existing constraints ruled out the obvious routes. `tool.call.toolview` supports taking over a tool's whole row by key, but the takeover is composition-wide and static, and the row's chrome cannot be imported by a product package — client bundle purity forbids it. Reading the active frame was also unavailable: `ctx.layout` exposes only writes, so nothing outside the three column occupants can learn the current mode.

## Decision

**The price-series row declares a child slot for the chart alone.** `tool.call.priceSeries` (`single`, session-scoped) receives the derived `model` and the tool's own `bars`. Unclaimed, the row draws `PriceSeriesBlock`, so every composition that registers nothing keeps the shipped chart bit for bit. The seat replaces the drawing and leaves the icon, summary, and expansion where they are, which is what lets a product package contribute a chart without touching row chrome it may not import.

**The row, not the chrome, decides what fills the seat.** `ToolRow.priceSeries` changed from a chart model to an already-rendered node. The row chrome no longer knows what a price series is, and the price-series row is the single place that picks between the shipped block and the seat's occupant.

**The source bars travel with the derived model.** `priceSeriesCardModel` now returns `{ model, bars }`. The derived geometry normalizes prices into a unit box and drops what a candle does not need, volume above all; an occupant that draws a volume pane would otherwise have to ask for a series it was already handed. `PriceSeriesBar` in ui-primitives gained the `volume` field it always carried in the data — both real callers read it off a bar that has it, and `dsh-tools` has required it all along.

**Occupancy is decided per conversation, not per composition.** `dsh-client-ui-watchlist` takes the seat for the whole Chico composition, and its occupant draws the workbench chart only when the conversation is bound to a name, falling back to `PriceSeriesBlock` otherwise. Binding is the test rather than the active frame: a conversation is bound at creation and never reassigned, so the chart a conversation draws does not change when the reader switches frames, and mounting Chico does not change how a price series looks in a conversation about a codebase.

**Indicators are computed over the whole series and sliced afterwards.** Computing them over the visible window would restart every warm-up at the left edge, so the same session would report a different MA60 depending on how far the reader had zoomed. Parameters follow mainland trading-software defaults (MA 5/10/20/60, MACD 12/26/9 with the doubled histogram, KDJ 9/3/3 seeded at 50), because re-tuning them would make every reading incomparable with the platforms Chico's users already read.

**The chart draws at measured pixel width.** A `ResizeObserver` feeds the real container width and the SVG maps 1:1 onto it, replacing the shipped block's stretched `preserveAspectRatio="none"` viewBox, under which candle proportions and label sizes changed with the container.

## Alternatives considered

**Take over `tool.call.toolview` for `market_history` from a Chico package.** Rejected on two counts: the takeover is composition-wide with no per-conversation grain, and the occupant would have to redraw the row chrome, which client bundle purity forbids a product package from importing.

**Add a mode reader to `ctx.layout` and key the chart on the active frame.** Rejected as both a wider change and a worse rule. It would widen the layout service for one consumer, and keying on the live frame makes a conversation's chart change form when the reader switches columns, which the binding test avoids.

**Give `PriceSeriesBlock` a `variant` prop and let Chico pass a "pro" value.** Rejected because it puts investment-domain concerns — indicator periods, pane switching, market colour conventions — inside a shared primitive that generic compositions also render, and no consumer of the primitive could then evolve independently.

**Extract the chart into a new `ui-chico-chart` package.** Deferred rather than rejected. The chart has exactly one owner today and two call sites inside it; a package boundary would be assembly without a second consumer. `products/chico/` still records `packages/client/ui-chico-*` as the eventual home if a second composition needs it.

## Consequences

A `market_history` call inside a conversation about a followed name draws candles, MA5/10/20/60, a switchable volume/MACD/KDJ pane, both axes, and a crosshair readout that names the session's open, high, low, close, indicator values, and averages; arrow keys move it and the headline price is an `<output>`, so the value is announced rather than changed silently. The name record panel draws the same chart unconditionally, that column existing only under an open name. Every other conversation, in Chico and in every other composition, renders exactly what it rendered before.

`ToolRow`'s `priceSeries` prop is a node rather than a model, which is a source-level change for any row that passed the model; only the price-series row did. `ui-watchlist` gains a type-only dependency on `ui-tool` for the slot declaration, the same arrangement it already has with `ui-conversation` and `ui-layout`.

Known gaps stay recorded in the two package READMEs: the chart offers five preset ranges and neither zoom nor pan; a bound conversation whose name has not been opened still draws the shipped candles, because occupancy reads the open name's conversation list; and the lower pane carries three indicators with no main-pane overlays and no way to configure either.
