/**
 * Sidebar slot contract: the registrant-side props composition for the
 * layout-owned `sidebar` slot, plus the holes this shell declares. The shell
 * owns column geometry (fold state machine, brand row, New Session) and the
 * frame switch; everything between that switch and the foot belongs to the
 * active `sidebar.mode` registrant, and the foot is the `sidebar.settings`
 * registrant's (ui-settings), followed by optional footer actions in
 * `sidebar.footer.action`.
 */
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-layout's SlotMap merge (the 'sidebar' entry) into every
// program that sees this contract, so PropsRuntime<'sidebar'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * One navigation frame: the whole region between the New Session button
     * and the foot, plus the switch entry that selects it. Declared by this
     * package's 'sidebar' entry (declaring is claiming); ui-workspace
     * registers the session browser as `sessions`, and a product registers
     * its own frame beside it.
     *
     * The shell draws one switch entry per registration, ordered by `order`,
     * and renders only the active one's region. The active frame is the
     * layout's, not the sidebar's, because the details column swaps occupant
     * with it too — a switch here that only moved this column would leave the
     * two columns describing different things.
     */
    'sidebar.mode': { kind: 'list'; scope: 'root'; owner: SidebarSectionOwnerProps }
    /**
     * The settings seat at the sidebar foot. Declared by this package's
     * 'sidebar' entry; ui-settings registers its trigger row + modal panel.
     * The sidebar passes only its column state — it holds no settings state.
     */
    'sidebar.settings': { kind: 'single'; scope: 'root'; owner: SidebarSettingsOwnerProps }
    /**
     * Optional actions beside Settings at the sidebar foot. Declared by this
     * package's 'sidebar' entry; each action receives only the column state.
     */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: SidebarFooterActionOwnerProps }
  }
}

/**
 * Owner share of the browser hole — the only facts crossing the shell/region
 * boundary. Business data and actions arrive through the region's own inject.
 */
export interface SidebarSectionOwnerProps {
  /** Shell fold-state output: wide renders the full browser, rail the icon column. */
  wide: boolean
  /** Rail icons request expansion; the browser rides the wide flip for focus. */
  expandSidebar: () => void
}

/**
 * Owner share of the sidebar settings seat: the column display state the
 * occupant's trigger row must render against (wide row vs rail icon).
 */
export interface SidebarSettingsOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** Owner share of an action rendered beside Settings at the sidebar foot. */
export interface SidebarFooterActionOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** One frame the switch offers, projected from the `sidebar.mode` ledger. */
export interface SidebarModeTab {
  /** Registration id; the value the layout mode is set to. */
  id: string
  /** Resolved switch label. */
  label: string
}

/**
 * Registrant-private injected share (arrives via the register inject
 * factory). The shell keeps only its own controls: starting a Session from
 * the New Session button, toggling the column, and reading the frame ledger.
 */
export type SidebarRootInjected = {
  /** Frames projected from the `sidebar.mode` slot ledger. */
  modes: {
    list: () => readonly SidebarModeTab[]
    subscribe: (fn: () => void) => () => void
    version: () => number
  }
  /**
   * Start a New Session: with a workspace, reuse-or-create its blank session
   * and open it; without one, inherit the current Session Workspace, then the
   * recent Workspace, or clear into the New Session pure view when none exist.
   */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Toggle the sidebar column through the layout service. */
  toggleSidebar: () => void
}

/**
 * Full component props: layout owner state/actions plus the declared holes'
 * render shares, this package's injected callbacks, and the standard locale
 * seat. No store is registered.
 */
export type SidebarRootComponentProps =
  PropsRuntime<'sidebar'>
  & PropsRenderSlots<'sidebar.mode' | 'sidebar.settings' | 'sidebar.footer.action'>
  & SidebarRootInjected & PropsLocale<'sidebar'>
