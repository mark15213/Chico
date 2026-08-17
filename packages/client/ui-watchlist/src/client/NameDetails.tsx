import { useId, useRef, useState, type ReactNode } from 'react'
import { IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { AttributionPanel } from './AttributionPanel.tsx'
import { RecordPanel, type RecordPanelInjected } from './RecordPanel.tsx'
import { instrumentLabel } from './watchlist-model.ts'
import { useWorkbenchFocus } from './workbench-store.ts'
import css from './NameDetails.module.css'

/**
 * What the investing frame's right column can show. Evidence leads: a reader
 * checking an answer is looking at the conversation, and the record is what
 * they write once they believe it.
 */
const TABS = ['evidence', 'record'] as const

/** Registration-side values used by the investing frame's details column. */
export interface NameDetailsInjected extends RecordPanelInjected {
  /** Collapse the details column without changing the open name or conversation. */
  closeDetails: () => void
}

/** Full props of the investing frame's details column. */
export type NameDetailsProps =
  PropsRuntime<'details'>
  & PropsRenderSlots<'investing.record.section'>
  & PropsLocale<'watchlist'>
  & NameDetailsInjected

/**
 * The investing frame's right column: what this conversation's answers rest on,
 * and the record kept about the open name.
 *
 * Both bodies stay mounted and the inactive one is hidden rather than
 * unmounted. Each holds work a switch must not discard — a half-written chain
 * entry on one side, an opened original on the other — and the record's reads
 * are already in flight when the reader arrives. Evidence is withheld during
 * navigation because the session runtime still holds the previous name until
 * the requested conversation is selected.
 * @param props - the session reader, record operations, selection, collapse action, and locale seat.
 * @returns the column.
 */
export function NameDetails({
  useSession, useWorkspaces, focus, read, dossier, append, setStance, closeDetails, renderSlot, t,
}: NameDetailsProps): ReactNode {
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [tab, setTab] = useState<(typeof TABS)[number]>('evidence')
  const { instrument, displayName, sessions, sessionStatus } = useWorkbenchFocus(focus)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const archived = new Set(archivedSessionIds)
  const sessionCount = sessions.filter(id => !archived.has(id)).length
  const label = instrument === null ? null : instrumentLabel(instrument)
  const name = displayName === null || displayName === '' ? label : displayName

  return (
    <div className={css.column}>
      <header className={css.chrome}>
        <div className={css.identity}>
          <span className={css.eyebrow}>{t('record.dossier')}</span>
          {name !== null && label !== null ? (
            <div className={css.titleLine}>
              <h2 className={css.title}>{name}</h2>
              <span className={css.ticker}>{label}</span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={css.collapse}
          aria-label={t('detail.collapse')}
          title={t('detail.collapse')}
          onClick={closeDetails}
        >
          <IconChevronRightOutline14 size={14} />
        </button>
      </header>
      <div className={css.tabs} role="tablist" aria-label={t('record.dossier')}>
        {TABS.map((id, index) => {
          const selected = tab === id
          return (
            <button
              key={id}
              ref={(element) => { tabRefs.current[index] = element }}
              id={`${tabsId}-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel-${id}`}
              className={css.tab}
              data-on={selected ? 'true' : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => { setTab(id) }}
              onKeyDown={(event) => {
                let nextIndex: number
                switch (event.key) {
                  case 'ArrowRight': nextIndex = (index + 1) % TABS.length; break
                  case 'ArrowLeft': nextIndex = (index - 1 + TABS.length) % TABS.length; break
                  case 'Home': nextIndex = 0; break
                  case 'End': nextIndex = TABS.length - 1; break
                  default: return
                }
                event.preventDefault()
                const nextTab = TABS[nextIndex] as (typeof TABS)[number]
                const nextButton = tabRefs.current[nextIndex] as HTMLButtonElement
                setTab(nextTab)
                nextButton.focus()
              }}
            >
              {t(`detail.tab.${id}`)}
            </button>
          )
        })}
      </div>
      <div
        id={`${tabsId}-panel-evidence`}
        className={css.body}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-evidence`}
        hidden={tab !== 'evidence'}
      >
        {sessionStatus === 'ready'
          ? <AttributionPanel useSession={useSession} t={t} />
          : (
            <p className={sessionStatus === 'failed' ? css.failure : css.pending} role={sessionStatus === 'failed' ? 'alert' : 'status'}>
              {t(sessionStatus === 'failed' ? 'evidence.conversationFailed' : 'evidence.openingConversation')}
            </p>
          )}
      </div>
      <div
        id={`${tabsId}-panel-record`}
        className={css.body}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-record`}
        hidden={tab !== 'record'}
      >
        <RecordPanel
          focus={focus}
          read={read}
          dossier={dossier}
          append={append}
          setStance={setStance}
          sessionCount={sessionCount}
          renderSlot={renderSlot}
          t={t}
        />
      </div>
    </div>
  )
}
