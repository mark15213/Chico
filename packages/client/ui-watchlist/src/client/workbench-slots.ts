/**
 * Slots the investing frame declares inside its own sidebar region: the
 * workbench section above the followed names, and the mark a workbench
 * feature may put on one name's row. Both are declared by this package's
 * `sidebar.mode` registration (declaring is claiming), so unloading the
 * investing frame takes them down with it.
 */
import type { InstrumentRef } from '@deepseek-ai/dsh-api-remotes/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * The workbench block above the followed names: one entry per standing
     * capability the reader manages rather than reads — automations today,
     * and whatever else earns a permanent seat beside them. Entries render by
     * ascending `order`, and an empty ledger draws no block at all.
     *
     * An entry is a row that opens a page in the centre column; it receives
     * the open page and the layout's page transitions so it can mark itself
     * as the one currently showing. It is not a place for a name, a
     * conversation, or anything else the followed list below already owns.
     */
    'investing.workbench.section': { kind: 'list'; scope: 'root'; owner: WorkbenchSectionOwnerProps }
    /**
     * A mark on one followed name's row, stating that something in the
     * workbench applies to that name.
     *
     * Entries MUST render a non-interactive mark. The row itself is the
     * button that opens the name, so a control here would nest inside it;
     * an entry that needs a click belongs on the page its feature owns.
     */
    'investing.name.mark': { kind: 'list'; scope: 'root'; owner: NameMarkOwnerProps }
    /**
     * A block in the Record tab, under the open name's own figures and above
     * its decision chain. Declared by this package's `details` registration.
     *
     * This is where a workbench feature states what it holds ABOUT this name —
     * which automations watch it, say — and offers the way to attach more.
     * The chain below it is the user's own writing and stays this package's.
     */
    'investing.record.section': { kind: 'list'; scope: 'root'; owner: NameMarkOwnerProps }
  }
}

/** Owner share of a workbench section entry. */
export interface WorkbenchSectionOwnerProps {
  /** False while the sidebar renders its 56px rail; entries draw an icon only. */
  wide: boolean
  /** Which page covers the centre column, or null while the conversation shows. */
  page: string | null
  /** Show this entry's page in the centre column. */
  openPage: (page: string) => void
  /** Return the centre column to the conversation. */
  closePage: () => void
}

/** Owner share of a mark drawn on one followed name's row. */
export interface NameMarkOwnerProps {
  /** The name the row is about. */
  instrument: InstrumentRef
  /** That name's display name, for a mark that labels itself. */
  displayName: string
}
