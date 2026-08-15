import { useEffect, useState, type ReactNode } from 'react'
import type { InstrumentRef, NameDossier } from '@deepseek-ai/dsh-api-remotes/client'
import { PriceSeriesBlock, priceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { directionOf, formatChange, formatLast, instrumentLabel } from './watchlist-model.ts'
import css from './NamePage.module.css'

/** Props of the in-tab name page. */
export interface NamePageProps {
  /** The instrument to read. */
  instrument: InstrumentRef
  /** Read one name's record with its quote and history. */
  dossier: (instrument: InstrumentRef, sessions: number) => Promise<NameDossier>
  /** Return to the list. */
  onBack: () => void
  /** Take this name off the watchlist and return to the list. */
  onUnfollow: (instrument: InstrumentRef) => void
  /** The tab's locale seat. */
  t: TranslateNS<'watchlist'>
}

type PageState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly dossier: NameDossier }

/**
 * Sessions of history the page draws. One trading quarter is the range a
 * professional reads a name's recent behavior over; the market-data seam
 * refuses anything above its own ceiling.
 */
const HISTORY_SESSIONS = 60

/**
 * One followed name read on its own: the figures, the candle chart behind
 * them, and when the record started. It is the destination a watchlist row
 * needs, and it lives inside the tab rather than in the details column, which
 * the tool inspector still owns.
 * @param props - the instrument, the Remote reads, and the navigation seats.
 * @returns the page element.
 */
export function NamePage({ instrument, dossier, onBack, onUnfollow, t }: NamePageProps): ReactNode {
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const label = instrumentLabel(instrument)

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    void Promise.resolve().then(() => dossier(instrument, HISTORY_SESSIONS)).then(
      (value) => { if (current) setState({ status: 'ready', dossier: value }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
    // The instrument is the identity; its object reference changes per render.
  }, [dossier, instrument.market, instrument.symbol])

  const view = state.status === 'ready' ? state.dossier : null
  const chart = view === null || view.bars.length === 0
    ? null
    : priceSeriesModel({
      label,
      bars: view.bars,
      adjustment: view.adjustment,
      currency: view.quote?.currency,
    })

  return (
    <div className={css.page} aria-busy={state.status === 'loading'}>
      <header className={css.header}>
        <button type="button" className={css.back} onClick={onBack}>{t('page.back')}</button>
        <h2 className={css.title}>{view?.displayName ?? label}</h2>
        <span className={css.code}>{label}</span>
      </header>

      {state.status === 'loading' ? <p className={css.status}>{t('page.loading')}</p> : null}
      {state.status === 'error' ? <p className={css.failure} role="alert">{t('page.error')}</p> : null}

      {view !== null ? (
        <>
          <div className={css.figures}>
            {view.quote === null ? (
              <span className={css.noQuote} title={t('noQuoteHint')}>{t('noQuote')}</span>
            ) : (
              <>
                <span className={css.last}>{formatLast(view.quote)}</span>
                <span className={css.change} data-direction={directionOf(view.quote.changePercent)}>
                  {formatChange(view.quote.changePercent)}
                </span>
                {view.quote.session === 'closed' ? (
                  <span className={css.session}>{t('session.closed')}</span>
                ) : null}
              </>
            )}
          </div>

          {chart !== null
            ? <PriceSeriesBlock model={chart} />
            : <p className={css.status}>{t('page.noHistory')}</p>}

          <dl className={css.record}>
            <div>
              <dt>{t('page.followedSince')}</dt>
              <dd>{view.firstFollowedAt.slice(0, 10)}</dd>
            </div>
          </dl>

          <p className={css.recordHint}>{t('page.recordHint')}</p>

          {view.followed ? (
            <button
              type="button"
              className={css.unfollow}
              onClick={() => { onUnfollow(instrument) }}
            >
              {t('unfollow')}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
