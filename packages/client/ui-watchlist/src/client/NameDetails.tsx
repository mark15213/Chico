import { useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { AttributionPanel } from './AttributionPanel.tsx'
import { RecordPanel, type RecordPanelInjected } from './RecordPanel.tsx'
import css from './NameDetails.module.css'

/**
 * What the investing frame's right column can show. Evidence leads: a reader
 * checking an answer is looking at the conversation, and the record is what
 * they write once they believe it.
 */
const TABS = ['evidence', 'record'] as const

/** Full props of the investing frame's details column. */
export type NameDetailsProps =
  PropsRuntime<'details'>
  & PropsLocale<'watchlist'>
  & RecordPanelInjected

/**
 * The investing frame's right column: what this conversation's answers rest on,
 * and the record kept about the open name.
 *
 * Both bodies stay mounted and the inactive one is hidden rather than
 * unmounted. Each holds work a switch must not discard — a half-written chain
 * entry on one side, an opened original on the other — and the record's reads
 * are already in flight when the reader arrives.
 * @param props - the slot's session kit, the record faces, and the locale seat.
 * @returns the column.
 */
export function NameDetails({ useSession, focus, read, dossier, append, t }: NameDetailsProps): ReactNode {
  const [tab, setTab] = useState<(typeof TABS)[number]>('evidence')
  return (
    <div className={css.column}>
      <div className={css.tabs} role="tablist">
        {TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={css.tab}
            data-on={tab === id ? 'true' : undefined}
            onClick={() => { setTab(id) }}
          >
            {t(`detail.tab.${id}`)}
          </button>
        ))}
      </div>
      <div className={css.body} role="tabpanel" hidden={tab !== 'evidence'}>
        <AttributionPanel useSession={useSession} t={t} />
      </div>
      <div className={css.body} role="tabpanel" hidden={tab !== 'record'}>
        <RecordPanel focus={focus} read={read} dossier={dossier} append={append} t={t} />
      </div>
    </div>
  )
}
