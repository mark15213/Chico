/** Tool UI slot declarations and their composed component props. */
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PriceSeriesBar, PriceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * Keyed atomic Tool call view, dispatched by the wire Tool name. Register
     * with `key: '<tool name>'` to own how one tool's calls render inside a
     * turn — the key domain is open (any wire tool name, including a tool your
     * own package registered), so there is no compile-time key set to pick
     * from and a typo simply never renders.
     *
     * A key the shipped composition already covers is replaced, not shared;
     * an unclaimed key falls back to the generic tool row, so registering is
     * additive for your own tool and a takeover for a shipped one. The owner
     * passes the call's identity, its frozen running-or-settled node, and the
     * expansion state (see ToolCallOwnerProps), so the view stays a pure
     * function of what the turn already knows.
     */
    'tool.call.toolview': { kind: 'keyed'; scope: 'session'; owner: ToolCallOwnerProps }
    /**
     * The chart that draws a completed price series, inside the price-series
     * row's expanded body. Unclaimed, the row draws `PriceSeriesBlock`, so a
     * composition that registers nothing keeps the shipped chart.
     *
     * The seat exists because a chart is the one card whose right form depends
     * on the surface: a conversation that mentions a stock in passing wants the
     * compact candles, while an investment workbench wants axes, indicators and
     * a readout. Both are the same series, so this replaces the drawing alone
     * and leaves the row chrome — icon, summary, expansion — where it is. An
     * occupant that wants the shipped chart back for some of its own states
     * renders `PriceSeriesBlock` itself; it lives in ui-primitives, which every
     * product package may import.
     */
    'tool.call.priceSeries': { kind: 'single'; scope: 'session'; owner: PriceSeriesChartOwnerProps }
  }
}

/** What the price-series row hands whatever chart occupies its chart seat. */
export interface PriceSeriesChartOwnerProps {
  /** The derived series: geometry, range, and the adjustment basis it carries. */
  model: PriceSeriesModel
  /** The bars as the tool reported them, carrying the fields the derived model drops (notably `volume`). */
  bars: readonly PriceSeriesBar[]
}

/** Standard owner currency supplied to every atomic Tool view. */
export interface ToolCallOwnerProps {
  /** Tool call identity, stable across running and settled forms. */
  callId: string
  /** Wire Tool name and keyed dispatch value. */
  toolName: string
  /** Frozen running call or settled result node. */
  block: ToolCallBlock
  /** Session workspace root for relative summaries. */
  cwd?: string | undefined
  /** Open a Tool argument path through the Host. */
  openFile: (path: string) => void
  /** Inspect this call in the trajectory view when available. */
  inspect?: (() => void) | undefined
}

/** Full props of a registered atomic Tool view. */
export type ToolCallViewProps = PropsRuntime<'tool.call.toolview'>

/** Full props of the Tool call-tree renderer registered as a `tool-call` Chat Node. */
export type ToolTreeProps = PropsRuntime<'conversation.chat.node', 'tool-call'>
  & PropsRenderSlots<'tool.call.toolview'>
  & PropsLocale<'conversation'>

/** Full props of the selected Tool output renderer in the details panel. */
export type ToolDetailsProps = PropsRuntime<'conversation.details.tool'> & PropsLocale<'conversation'>
