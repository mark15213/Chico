/**
 * The root entry's transient layout store: panel geometry as plain widths in
 * px (0 = closed). Module level exports the factory only — a module-level
 * handle would pin the store's identity in the module
 * cache (a de-facto singleton surviving plugin reloads). register() receives
 * the factory (exclusive use: the framework instantiates per entry), AppFrame
 * derives its PropsStore share from the return type, and the service face
 * receives the bound actions through the registration's inject hook.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  clampWidth, DEFAULT_MODE, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from './columns.ts'

/**
 * Layout store state: panel width preferences in px (0 = closed), plus the
 * narrow-viewport pair — `narrow` mirrors AppFrame's breakpoint reading
 * (viewport < SIDEBAR_AUTO_COLLAPSE) so toggleSidebar can pick semantics, and
 * `narrowExpanded` is the manual override that re-expands the auto-collapsed
 * sidebar over the squeezed center without rewriting the width preference;
 * `detailsExpansionOverride` does the same after the concession solver
 * auto-closes an otherwise-open details preference.
 */
type LayoutState = {
  sidebar: number
  details: number
  narrow: boolean
  narrowExpanded: boolean
  detailsExpansionOverride: boolean
  /**
   * Which frame the columns are showing. The sidebar and the details column
   * both swap occupant with it, so it belongs to the frame rather than to
   * either column; `sessions` is the harness's own frame.
   */
  mode: string
  /**
   * Which page occupies the centre column instead of the conversation, or
   * null while the conversation shows. A page is a surface the active frame
   * offers that is not about one conversation — managing a set of rules, say
   * — and the details column keys off it for the same reason it keys off the
   * mode: the right column describes whatever the centre is showing.
   */
  page: string | null
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setDetails: (draft: LayoutState, px: number) => void
  toggleSidebar: (draft: LayoutState) => void
  setNarrow: (draft: LayoutState, narrow: boolean) => void
  setMode: (draft: LayoutState, mode: string) => void
  openPage: (draft: LayoutState, page: string) => void
  closePage: (draft: LayoutState) => void
  openDetails: (draft: LayoutState) => void
  restoreDetails: (draft: LayoutState) => void
  releaseDetailsExpansion: (draft: LayoutState) => void
  closeDetails: (draft: LayoutState) => void
}

/**
 * Create the layout panel store handle. The preference IS the width, so
 * closing a panel forgets its drag width — reopening restores the contract
 * default. Actions are the complete write set: drag writes clamp
 * into the panel's contract range and never cross the open/closed line;
 * open/close transitions write 0 / the default explicitly. Below the
 * auto-collapse breakpoint (AppFrame feeds setNarrow) the sidebar toggle
 * flips the narrowExpanded override instead of the preference.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions>  {
  const handle = defineStore({
    init: (): LayoutState => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      narrow: false,
      narrowExpanded: false,
      detailsExpansionOverride: false,
      mode: DEFAULT_MODE,
      page: null,
    }),
    actions: {
      setSidebar: (d, px: number) => { d.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (d, px: number) => { d.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      // Narrow toggles flip only the override: the width preference survives
      // untouched, so re-widening restores the pre-squeeze layout.
      toggleSidebar: (d) => {
        if (d.narrow) d.narrowExpanded = !d.narrowExpanded
        else d.sidebar = d.sidebar === 0 ? SIDEBAR_DEFAULT : 0
      },
      // Crossing the breakpoint in either direction drops the override: the
      // narrow default is auto-collapsed, the wide state is the preference.
      setNarrow: (d, narrow: boolean) => {
        if (d.narrow === narrow) return
        d.narrow = narrow
        d.narrowExpanded = false
      },
      // Switching frames closes the details panel: its occupant changes with
      // the mode, so leaving it open would swap a panel's contents under a
      // reader who was looking at something else.
      setMode: (d, mode: string) => {
        if (d.mode === mode) return
        d.mode = mode
        d.page = null
        d.details = 0
        d.detailsExpansionOverride = false
      },
      // A page swap changes the details occupant exactly as a frame switch
      // does, so both transitions close the panel rather than leave one
      // frame's detail beside another's centre. The page itself reveals the
      // column again once the reader selects something inside it.
      openPage: (d, page: string) => {
        if (d.page === page) return
        d.page = page
        d.details = 0
        d.detailsExpansionOverride = false
      },
      closePage: (d) => {
        if (d.page === null) return
        d.page = null
        d.details = 0
        d.detailsExpansionOverride = false
      },
      openDetails: (d) => { if (d.details === 0) d.details = DETAILS_DEFAULT },
      // The navigation frame calls this only from its explicit recovery
      // affordance. Unlike openDetails, it may override responsive concession.
      restoreDetails: (d) => {
        if (d.details === 0) d.details = DETAILS_DEFAULT
        d.detailsExpansionOverride = true
      },
      releaseDetailsExpansion: (d) => { d.detailsExpansionOverride = false },
      closeDetails: (d) => {
        d.details = 0
        d.detailsExpansionOverride = false
      },
    },
  })
  return handle
}
