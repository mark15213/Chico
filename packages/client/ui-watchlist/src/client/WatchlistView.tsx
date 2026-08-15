import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type {
  InstrumentRef,
  NameDossier,
  WatchlistFollowResult,
  WatchlistSearchResult,
  WatchlistSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { instrumentLabel, normalizeQuery, rowFigures } from './watchlist-model.ts'
import { NamePage } from './NamePage.tsx'
import css from './WatchlistView.module.css'

/** Registration-side Remote face the view calls through. */
export interface WatchlistViewInjected {
  /** Read the current rows with their quotes. */
  list: () => Promise<WatchlistSnapshot>
  /** Find listings a typed query names, marked with whether they are followed. */
  search: (query: string, limit: number, signal?: AbortSignal) => Promise<WatchlistSearchResult>
  /** Read one name's record with its quote and session history. */
  dossier: (instrument: InstrumentRef, sessions: number) => Promise<NameDossier>
  /** Follow one instrument, resolving its name from the venue. */
  follow: (instrument: InstrumentRef) => Promise<WatchlistFollowResult>
  /** Take one instrument off the watchlist, keeping its record. */
  unfollow: (instrument: InstrumentRef) => Promise<void>
}

/** Full component props assembled by the conversation view-ring renderer. */
export type WatchlistViewProps =
  PropsRuntime<'conversation.view'>
  & PropsLocale<'watchlist'>
  & InjectFace<WatchlistViewInjected>

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: WatchlistSnapshot }

type LookupState =
  | { readonly status: 'idle' }
  | { readonly status: 'searching' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: WatchlistSearchResult }

/**
 * How many matches the picker draws. The surface that renders the list is what
 * knows how many it can show, so the limit travels with the request; the
 * market-data seam refuses anything above its own ceiling.
 */
const MATCH_LIMIT = 8

/**
 * Idle time before a query is sent. A lookup crosses to the host and on to a
 * provider, so sending one per keystroke would spend a request on every prefix
 * of a word nobody finished typing.
 */
const LOOKUP_DEBOUNCE_MS = 250

/**
 * The watchlist tab: every followed name with its current price, and the
 * lookup that puts a name on the list. The tab is useful with an empty record —
 * an empty watchlist states how to fill it rather than showing a blank panel.
 */
export function WatchlistView({ list, search, dossier, follow, unfollow, t }: WatchlistViewProps): ReactNode {
  const fieldId = useId()
  const [opened, setOpened] = useState<InstrumentRef | null>(null)
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [adding, setAdding] = useState<string | null>(null)
  const [addFailed, setAddFailed] = useState(false)
  const [rowFailure, setRowFailure] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const reload = useCallback(() => { setRequest(value => value + 1) }, [])

  // One in-flight lookup at a time: a later keystroke aborts the request the
  // previous one started, so a slow early prefix cannot land over a later
  // answer.
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => {
    const text = normalizeQuery(query)
    if (text === null) {
      setLookup({ status: 'idle' })
      return
    }
    setLookup({ status: 'searching' })
    const timer = window.setTimeout(() => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      void search(text, MATCH_LIMIT, controller.signal).then(
        (result) => { if (!controller.signal.aborted) setLookup({ status: 'ready', result }) },
        () => { if (!controller.signal.aborted) setLookup({ status: 'error' }) },
      )
    }, LOOKUP_DEBOUNCE_MS)
    return () => { window.clearTimeout(timer) }
  }, [query, search])

  const add = (instrument: InstrumentRef): void => {
    const label = instrumentLabel(instrument)
    setAdding(label)
    setAddFailed(false)
    void follow(instrument).then(
      (result) => {
        setAdding(null)
        if (!result.ok) {
          setAddFailed(true)
          return
        }
        setQuery('')
        reload()
      },
      () => {
        setAdding(null)
        setAddFailed(true)
      },
    )
  }

  const remove = (instrument: InstrumentRef): void => {
    setRowFailure(null)
    void unfollow(instrument).then(reload, () => { setRowFailure(instrumentLabel(instrument)) })
  }

  const retry = (): void => {
    setState({ status: 'loading' })
    reload()
  }

  const rows = state.status === 'ready' ? state.snapshot.rows : []

  // The page replaces the list inside the tab rather than opening beside it:
  // the details column still belongs to the tool inspector, and a name is read
  // instead of the list, not next to it.
  if (opened !== null) {
    return (
      <NamePage
        instrument={opened}
        dossier={dossier}
        t={t}
        onBack={() => { setOpened(null) }}
        onUnfollow={(instrument) => {
          setOpened(null)
          remove(instrument)
        }}
      />
    )
  }

  return (
    <div className={css.view} aria-busy={state.status === 'loading'}>
      <header className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        {state.status === 'ready' ? (
          <span className={css.count}>{t('count', { count: rows.length })}</span>
        ) : null}
        <button type="button" className={css.refresh} onClick={retry}>{t('refresh')}</button>
      </header>

      <div className={css.lookup}>
        <label className={css.field} htmlFor={fieldId}>
          <span className={css.visuallyHidden}>{t('lookup.label')}</span>
          <input
            id={fieldId}
            type="search"
            className={css.input}
            value={query}
            placeholder={t('lookup.placeholder')}
            aria-label={t('lookup.label')}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setAddFailed(false)
            }}
          />
        </label>
        {lookup.status === 'searching' ? <p className={css.status}>{t('lookup.searching')}</p> : null}
        {lookup.status === 'error' ? (
          <p className={css.failure} role="alert">{t('lookup.failed')}</p>
        ) : null}
        {lookup.status === 'ready' && lookup.result.matches.length === 0 ? (
          <p className={css.status}>{t('lookup.empty')}</p>
        ) : null}
        {lookup.status === 'ready' && lookup.result.matches.length > 0 ? (
          <ul className={css.matches}>
            {lookup.result.matches.map((match) => {
              const label = instrumentLabel(match.instrument)
              return (
                <li className={css.match} key={label} data-instrument={label}>
                  <span className={css.name}>{match.name}</span>
                  <span className={css.code}>{label}</span>
                  {match.followed ? (
                    <span className={css.followedTag}>{t('lookup.alreadyFollowed')}</span>
                  ) : (
                    <button
                      type="button"
                      className={css.add}
                      disabled={adding !== null}
                      aria-label={`${t('lookup.add')} ${match.name}`}
                      onClick={() => { add(match.instrument) }}
                    >
                      {adding === label ? t('lookup.adding') : t('lookup.add')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
        {addFailed ? <p className={css.failure} role="alert">{t('lookup.addFailed')}</p> : null}
      </div>

      {rowFailure !== null ? (
        <p className={css.failure} role="alert">{`${rowFailure} · ${t('unfollowFailed')}`}</p>
      ) : null}

      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' && rows.length === 0 ? (
        <div className={css.empty}>
          <p>{t('empty')}</p>
          <p className={css.emptyHint}>{t('emptyHint')}</p>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className={css.rows}>
          {rows.map((row) => {
            const figures = rowFigures(row)
            return (
              <li className={css.row} key={figures.instrumentLabel} data-instrument={figures.instrumentLabel}>
                <button
                  type="button"
                  className={css.identity}
                  aria-label={`${t('page.open')} ${row.displayName}`}
                  onClick={() => { setOpened(row.instrument) }}
                >
                  <strong className={css.name}>{row.displayName}</strong>
                  <span className={css.code}>{figures.instrumentLabel}</span>
                </button>
                <div className={css.figures}>
                  {figures.last === null ? (
                    <span className={css.noQuote} title={t('noQuoteHint')}>{t('noQuote')}</span>
                  ) : (
                    <>
                      <span className={css.last}>{figures.last}</span>
                      <span className={css.change} data-direction={figures.direction}>{figures.change}</span>
                      {row.quote?.session === 'closed' ? (
                        <span className={css.session}>{t('session.closed')}</span>
                      ) : null}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={css.unfollow}
                  aria-label={`${t('unfollow')} ${row.displayName}`}
                  onClick={() => { remove(row.instrument) }}
                >
                  {t('unfollow')}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
