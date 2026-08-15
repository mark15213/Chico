import { useEffect, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useWatchlist, type WatchlistSource } from './watchlist-store.ts'
import { rowFigures } from './watchlist-model.ts'
import css from './WatchlistRail.module.css'

/** Registration-side face: the rows, shared with the tab. */
export interface WatchlistRailInjected {
  /** The rows, shared with the watchlist tab. */
  rows: WatchlistSource
}

/** Full props of the pinned sidebar list. */
export type WatchlistRailProps =
  PropsRuntime<'sidebar.pinned'>
  & PropsLocale<'watchlist'>
  & WatchlistRailInjected

/**
 * How many names the rail draws. The sidebar's pinned region takes its own
 * height and must not squeeze the session browser, so the list is capped and
 * says how many it left out rather than scrolling on its own.
 */
const RAIL_ROWS = 8

/**
 * The followed names, pinned above the session browser. It is a display: a
 * professional glances at their book while working on something else. Rows do
 * not navigate, because the sidebar is root-scoped and the surfaces that could
 * receive a name — the conversation view ring, the details column — are not
 * reachable from here.
 * @param props - the shared rows and the locale seat.
 * @returns the pinned list, or nothing while the record is empty.
 */
export function WatchlistRail({ rows: source, t }: WatchlistRailProps): ReactNode {
  const { status, rows } = useWatchlist(source)
  const refresh = source.refresh

  useEffect(() => { void refresh() }, [refresh])

  // Nothing to pin: an empty region is better than a heading over a blank
  // space, and the tab is where a first name gets followed.
  if (status !== 'ready' || rows.length === 0) return null

  const shown = rows.slice(0, RAIL_ROWS)
  const hidden = rows.length - shown.length

  return (
    <section className={css.rail} aria-label={t('title')}>
      <h2 className={css.heading}>{t('title')}</h2>
      <ul className={css.rows}>
        {shown.map((row) => {
          const figures = rowFigures(row)
          return (
            <li className={css.row} key={figures.instrumentLabel} data-instrument={figures.instrumentLabel}>
              <span className={css.name} title={figures.instrumentLabel}>{row.displayName}</span>
              {figures.change === null
                ? <span className={css.noQuote}>{t('noQuote')}</span>
                : (
                  <>
                    <span className={css.last}>{row.quote?.last}</span>
                    <span className={css.change} data-direction={figures.direction}>{figures.change}</span>
                  </>
                )}
            </li>
          )
        })}
      </ul>
      {hidden > 0 ? <p className={css.more}>{t('rail.more', { count: hidden })}</p> : null}
    </section>
  )
}
