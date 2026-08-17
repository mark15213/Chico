import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { InstrumentRef, SessionId, WatchlistSearchResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button,
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconNewChatOutline16,
  IconRefreshOutline14,
  IconSearchOutline16,
  IconTrashOutline16,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { useWatchlist, type WatchlistSource } from './watchlist-store.ts'
import { useWorkbenchFocus, type WorkbenchSelection } from './workbench-store.ts'
import { instrumentLabel, normalizeQuery, rowFigures, sameInstrument } from './watchlist-model.ts'
// Type-only: pulls this package's own SlotMap merge (the workbench block and
// the name mark) into every program that sees the frame's props.
import type {} from './workbench-slots.ts'
import css from './NamesFrame.module.css'

/**
 * The workbench block's own ledger reading. The frame draws no heading for an
 * empty block, and only the registration side can see the slot ledger, so the
 * count crosses as an observable rather than being guessed from the rendered
 * output.
 */
export interface WorkbenchLedger {
  /** How many workbench entries are registered. */
  count: () => number
  /** Subscribe to registration changes. */
  subscribe: (fn: () => void) => () => void
  /** Ledger version, for the store subscription's snapshot identity. */
  version: () => number
}

/** Registration-side face the names frame calls through. */
export interface NamesFrameInjected {
  /** The rows, shared with every other watchlist surface. */
  rows: WatchlistSource
  /** Whether the workbench block has anything to draw. */
  workbench: WorkbenchLedger
  /** Find listings a typed query names, marked with whether they are followed. */
  search: (query: string, limit: number, signal?: AbortSignal) => Promise<WatchlistSearchResult>
  /** Follow one instrument, resolving its name from the venue. */
  follow: (instrument: InstrumentRef) => Promise<unknown>
  /** Which name the workbench is showing, and its conversations. */
  focus: WorkbenchSelection
  /**
   * Show one name: every column moves, including the record panel, which has
   * to be revealed as well. A selection that moves a column nobody can see is
   * not navigation.
   */
  open: (instrument: InstrumentRef, displayName: string) => void
  /** Select one of the open name's conversations in the centre column. */
  openConversation: (id: SessionId) => void
  /** Begin a new conversation about the open name. */
  startConversation: (instrument: InstrumentRef) => Promise<void>
  /** Mark this frame active while its sidebar occupant is mounted. */
  activateConversationNavigation: () => () => void
  /**
   * Remove one conversation from user-facing lists through the durable global
   * archive set. Its log and name-record binding remain available for recovery.
   */
  archiveConversation: (id: SessionId) => Promise<void>
}

/** Full props of the sidebar's names frame. */
export type NamesFrameProps =
  PropsRuntime<'sidebar.mode'>
  & PropsRenderSlots<'investing.workbench.section' | 'investing.name.mark'>
  & PropsLocale<'watchlist'>
  & NamesFrameInjected

/** How many matches the picker draws; the seam refuses anything larger. */
const MATCH_LIMIT = 8

/** Idle time before a query is sent, so a burst of keystrokes costs one read. */
const LOOKUP_DEBOUNCE_MS = 250

/**
 * The workbench's left column: every followed name, in follow order, with the
 * price and the marker for a thesis still waiting. Selecting one moves the
 * other two columns, which is what makes this a workbench rather than a list.
 * The open name expands to its own conversations — "what did I say about this
 * one last week" is a real question, and its answer belongs beside the name
 * rather than in a global list sorted by time.
 *
 * Order is the order the user built the list in. Sorting by anything the
 * market decides would reshuffle the column under the reader between glances.
 * @param props - the shared rows, the lookup, the selection, and the locale seat.
 * @returns the names column when wide; the rail carries only details recovery.
 */
export function NamesFrame({
  rows: source, workbench, search, follow, focus, open, openConversation, startConversation,
  archiveConversation, activateConversationNavigation, useSessions, useWorkspaces, wide,
  detailsClosed, openDetails, page, openPage, closePage, renderSlot, t,
}: NamesFrameProps): ReactNode {
  const fieldId = useId()
  useSyncExternalStore(workbench.subscribe, workbench.version)
  const { status, rows } = useWatchlist(source)
  const { instrument: opened, sessions } = useWorkbenchFocus(focus)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const archived = new Set(archivedSessionIds)
  const visibleSessions = sessions.filter(id => !archived.has(id))
  // Titles and the current selection come from the live session list, so a
  // renamed conversation reads correctly without the record being re-read.
  const titles = useSessions(list => visibleSessions.map(id => ({
    id,
    title: list.byId[id]?.displayTitle ?? id,
    current: list.current === id,
  })))
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<WatchlistSearchResult | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: SessionId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  useEffect(() => activateConversationNavigation(), [activateConversationNavigation])
  useEffect(() => { void source.refresh() }, [source])

  // One in-flight lookup at a time: a later keystroke aborts the request the
  // previous one started, so a slow early prefix cannot land over a later one.
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => {
    const text = normalizeQuery(query)
    if (text === null) {
      setMatches(null)
      return
    }
    const timer = window.setTimeout(() => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      void search(text, MATCH_LIMIT, controller.signal).then(
        (result) => { if (!controller.signal.aborted) setMatches(result) },
        () => { if (!controller.signal.aborted) setMatches({ matches: [] }) },
      )
    }, LOOKUP_DEBOUNCE_MS)
    return () => { window.clearTimeout(timer) }
  }, [query, search])

  // The rail is 56px of icons; a name beside a price does not fit. Workbench
  // entries survive as their own icons — what runs unattended stays reachable
  // from a collapsed column — and when the details column is closed, its
  // recovery action still has to remain visible.
  if (!wide) {
    const railDetails = opened !== null && detailsClosed
      ? (
        <button
          type="button"
          className={css.railDetails}
          aria-label={t('detail.expand')}
          title={t('detail.expand')}
          onClick={openDetails}
        >
          <IconChevronLeftOutline14 size={14} />
        </button>
      )
      : null
    if (workbench.count() === 0) return railDetails
    return (
      <div className={css.rail}>
        {renderSlot('investing.workbench.section', { wide, page, openPage, closePage })}
        {railDetails}
      </div>
    )
  }

  const picking = matches !== null

  return (
    <div className={css.frame}>
      {/* The workbench block leads, because what runs unattended is read
          before the list it runs over. An empty ledger draws nothing at all,
          so a composition without workbench features opens on the names. */}
      {workbench.count() > 0 ? (
        <section className={css.workbench} aria-label={t('workbench.title')}>
          <h2 className={css.sectionHeading}>{t('workbench.title')}</h2>
          <div className={css.workbenchEntries}>
            {renderSlot('investing.workbench.section', { wide, page, openPage, closePage })}
          </div>
        </section>
      ) : null}

      <header className={css.overview}>
        <div className={css.overviewCopy}>
          <h2 className={css.heading}>{t('title')}</h2>
          {status === 'ready' ? <span className={css.count}>{t('count', { count: rows.length })}</span> : null}
        </div>
        <div className={css.overviewActions}>
          {opened !== null && detailsClosed ? (
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('detail.expand')}
              title={t('detail.expand')}
              onClick={openDetails}
            >
              <IconChevronLeftOutline14 size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('refresh')}
            title={t('refresh')}
            disabled={status === 'loading'}
            onClick={() => { void source.refresh() }}
          >
            <IconRefreshOutline14 size={14} />
          </button>
        </div>
      </header>

      <label className={css.field} htmlFor={fieldId}>
        <span className={css.visuallyHidden}>{t('lookup.label')}</span>
        <IconSearchOutline16 className={css.searchIcon} size={14} />
        <input
          id={fieldId}
          type="search"
          className={css.input}
          value={query}
          placeholder={t('lookup.placeholder')}
          aria-label={t('lookup.label')}
          onChange={(event) => { setQuery(event.currentTarget.value) }}
        />
      </label>

      {picking ? (
        <div className={css.picker} aria-label={t('lookup.results')}>
          {matches.matches.length === 0 ? <p className={css.note}>{t('lookup.empty')}</p> : null}
          {matches.matches.map((match) => {
            const label = instrumentLabel(match.instrument)
            return (
              <div className={css.match} key={label} data-instrument={label}>
                <button
                  type="button"
                  className={css.matchOpen}
                  aria-label={`${t('page.open')} ${match.name}`}
                  onClick={() => {
                    setQuery('')
                    open(match.instrument, match.name)
                  }}
                >
                  <span className={css.name}>{match.name}</span>
                  <span className={css.code}>{label}</span>
                </button>
                {match.followed ? (
                  <span className={css.followedTag}>{t('lookup.alreadyFollowed')}</span>
                ) : (
                  <button
                    type="button"
                    className={css.add}
                    aria-label={`${t('lookup.add')} ${match.name}`}
                    onClick={() => { void follow(match.instrument).then(() => source.refresh()) }}
                  >
                    {t('lookup.add')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {status === 'loading' ? <p className={css.note}>{t('loading')}</p> : null}
      {status === 'error' ? <p className={css.failure} role="alert">{t('error')}</p> : null}
      {status === 'ready' && rows.length === 0 && !picking ? (
        <div className={css.empty}>
          <p>{t('empty')}</p>
          <p className={css.note}>{t('emptyHint')}</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className={css.rows}>
          {rows.map((row) => {
            const figures = rowFigures(row)
            const on = opened !== null && sameInstrument(opened, row.instrument)
            return (
              <li key={figures.instrumentLabel} data-instrument={figures.instrumentLabel}>
                <button
                  type="button"
                  className={css.row}
                  data-open={on ? 'true' : undefined}
                  aria-current={on ? 'true' : undefined}
                  aria-label={`${t('record.open')} ${row.displayName}`}
                  onClick={() => { open(row.instrument, row.displayName) }}
                >
                  <span
                    className={css.mark}
                    data-mark={row.openTheses > 0 ? 'unverified' : 'plain'}
                    title={row.openTheses > 0 ? t('mark.unverified', { count: row.openTheses }) : undefined}
                    aria-label={row.openTheses > 0 ? t('mark.unverified', { count: row.openTheses }) : undefined}
                  >
                    {row.openTheses > 0 ? row.openTheses : <span className={css.quietMark} aria-hidden />}
                  </span>
                  <span className={css.identity}>
                    <span className={css.name}>{row.displayName}</span>
                    <span className={css.code}>{figures.instrumentLabel}</span>
                  </span>
                  <span className={css.figures}>
                    {figures.change === null
                      ? <span className={css.noQuote}>{t('noQuote')}</span>
                      : (
                        <>
                          <span className={css.last}>{row.quote?.last}</span>
                          <span className={css.change} data-direction={figures.direction}>{figures.change}</span>
                        </>
                      )}
                  </span>
                  {/* Marks are non-interactive by contract: this row is
                      already the button that opens the name. */}
                  <span className={css.marks}>
                    {renderSlot('investing.name.mark', {
                      instrument: row.instrument,
                      displayName: row.displayName,
                    })}
                  </span>
                  <IconChevronRightOutline14 className={css.rowArrow} size={14} />
                </button>
                {on ? (
                  <ul className={css.conversations}>
                    <li className={css.conversationHead}>
                      <span>{t('conversation.title')}</span>
                      <span>{titles.length}</span>
                    </li>
                    {titles.map(entry => (
                      <li className={css.conversationRow} key={entry.id}>
                        <button
                          type="button"
                          className={css.conversation}
                          data-current={entry.current ? 'true' : undefined}
                          onClick={() => { openConversation(entry.id) }}
                        >
                          <span className={css.conversationDot} aria-hidden />
                          <span className={css.conversationTitle}>{entry.title}</span>
                        </button>
                        <button
                          type="button"
                          className={css.deleteConversation}
                          aria-label={t('conversation.deleteAction', { name: entry.title })}
                          title={t('conversation.deleteAction', { name: entry.title })}
                          onClick={() => {
                            setDeleteFailed(false)
                            setDeleteTarget({ id: entry.id, title: entry.title })
                          }}
                        >
                          <IconTrashOutline16 size={13} />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className={css.newConversation}
                        onClick={() => { void startConversation(row.instrument) }}
                      >
                        <IconNewChatOutline16 size={13} />
                        {t('conversation.new')}
                      </button>
                    </li>
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (deleting) return
          setDeleteTarget(null)
          setDeleteFailed(false)
        }}
        closeLabel={t('conversation.cancel')}
        title={t('conversation.deleteTitle')}
        {...deleteTarget === null
          ? {}
          : { description: t('conversation.deleteDescription', { name: deleteTarget.title }) }}
        footer={(
          <>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setDeleteTarget(null)
                setDeleteFailed(false)
              }}
            >
              {t('conversation.cancel')}
            </Button>
            <Button
              variant="outline"
              className={css.deleteAction}
              disabled={deleting || deleteTarget === null}
              onClick={() => {
                if (deleteTarget === null || deleting) return
                setDeleting(true)
                setDeleteFailed(false)
                void archiveConversation(deleteTarget.id).then(
                  () => {
                    setDeleting(false)
                    setDeleteTarget(null)
                  },
                  () => {
                    setDeleting(false)
                    setDeleteFailed(true)
                  },
                )
              }}
            >
              {t('conversation.delete')}
            </Button>
          </>
        )}
      >
        {deleting ? <p className={css.deleteStatus} role="status">{t('conversation.deleting')}</p> : null}
        {deleteFailed ? <p className={css.deleteError} role="alert">{t('conversation.deleteFailed')}</p> : null}
      </Modal>
    </div>
  )
}
