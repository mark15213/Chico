import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import type {
  InstrumentRef,
  Market,
  WatchlistFollowResult,
  WatchlistSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { MARKETS, MARKET_LABEL_KEYS, instrumentLabel, normalizeSymbol, rowFigures } from './watchlist-model.ts'
import css from './WatchlistView.module.css'

/** Registration-side Remote face the view calls through. */
export interface WatchlistViewInjected {
  /** Read the current rows with their quotes. */
  list: () => Promise<WatchlistSnapshot>
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

/** Why the add form last refused, or null when it has nothing to report. */
type AddFailure = 'unknown' | 'failed' | null

/**
 * The watchlist tab: every followed name with its current price, and the one
 * form that puts a name on the list. The tab is useful with an empty record —
 * an empty watchlist states how to fill it rather than showing a blank panel.
 */
export function WatchlistView({ list, follow, unfollow, t }: WatchlistViewProps): ReactNode {
  const formId = useId()
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [market, setMarket] = useState<Market>('SZSE')
  const [symbol, setSymbol] = useState('')
  const [adding, setAdding] = useState(false)
  const [addFailure, setAddFailure] = useState<AddFailure>(null)
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

  const retry = (): void => {
    setState({ status: 'loading' })
    reload()
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const code = normalizeSymbol(symbol)
    if (code === null || adding) return
    setAdding(true)
    setAddFailure(null)
    void follow({ market, symbol: code }).then(
      (result) => {
        setAdding(false)
        if (result.ok) {
          setSymbol('')
          reload()
          return
        }
        setAddFailure('unknown')
      },
      () => {
        setAdding(false)
        setAddFailure('failed')
      },
    )
  }

  const remove = (instrument: InstrumentRef): void => {
    setRowFailure(null)
    void unfollow(instrument).then(reload, () => { setRowFailure(instrumentLabel(instrument)) })
  }

  const rows = state.status === 'ready' ? state.snapshot.rows : []

  return (
    <div className={css.view} aria-busy={state.status === 'loading'}>
      <header className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        {state.status === 'ready' ? (
          <span className={css.count}>{t('count', { count: rows.length })}</span>
        ) : null}
        <button type="button" className={css.refresh} onClick={retry}>{t('refresh')}</button>
      </header>

      <form className={css.add} onSubmit={submit}>
        <label className={css.field} htmlFor={`${formId}-market`}>
          <span className={css.fieldLabel}>{t('add.market')}</span>
          <select
            id={`${formId}-market`}
            className={css.select}
            value={market}
            onChange={(event) => { setMarket(event.currentTarget.value as Market) }}
          >
            {MARKETS.map(value => (
              <option key={value} value={value}>{t(MARKET_LABEL_KEYS[value])}</option>
            ))}
          </select>
        </label>
        <label className={css.field} htmlFor={`${formId}-symbol`}>
          <span className={css.fieldLabel}>{t('add.symbol')}</span>
          <input
            id={`${formId}-symbol`}
            className={css.input}
            value={symbol}
            placeholder={t('add.symbolPlaceholder')}
            onChange={(event) => {
              setSymbol(event.currentTarget.value)
              setAddFailure(null)
            }}
          />
        </label>
        <button type="submit" className={css.submit} disabled={adding || normalizeSymbol(symbol) === null}>
          {adding ? t('add.pending') : t('add.submit')}
        </button>
      </form>
      {addFailure !== null ? (
        <p className={css.failure} role="alert">
          {t(addFailure === 'unknown' ? 'add.unknown' : 'add.failed')}
        </p>
      ) : null}
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
                <div className={css.identity}>
                  <strong className={css.name}>{row.displayName}</strong>
                  <span className={css.code}>{figures.instrumentLabel}</span>
                </div>
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
