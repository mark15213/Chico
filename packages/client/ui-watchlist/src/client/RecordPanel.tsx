import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type {
  ChainEntry,
  ChainEntryRequest,
  InstrumentRef,
  NameDossier,
  NameRecordView,
} from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconListPenOutline16,
  IconPlusOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { ProChart } from './chart/ProChart.tsx'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { directionOf, formatChange, formatLast, instrumentLabel } from './watchlist-model.ts'
import { useWorkbenchFocus, type WorkbenchSelection } from './workbench-store.ts'
import css from './RecordPanel.module.css'

/**
 * Registration-side face the record panel calls through. The registration is
 * the column ({@link NameDetails}), which passes this face down, so the shape
 * is declared here beside its one consumer.
 */
export interface RecordPanelInjected {
  /** Which name the workbench is showing. */
  focus: WorkbenchSelection
  /** Read one name's record: the stance, the chain, and its sessions. */
  read: (instrument: InstrumentRef) => Promise<NameRecordView>
  /** Read one name's figures and session history. */
  dossier: (instrument: InstrumentRef, sessions: number) => Promise<NameDossier>
  /** Record one chain entry. */
  append: (instrument: InstrumentRef, request: ChainEntryRequest) => Promise<ChainEntry>
}

/** Full props of the record tab. */
export type RecordPanelProps = RecordPanelInjected & PropsLocale<'watchlist'>

/** Sessions of history the header chart draws; the seam bounds anything larger. */
const HISTORY_SESSIONS = 60

/** The kinds a user writes by hand. A verification settles a thesis, so it is offered per thesis. */
const WRITABLE = ['thesis', 'decision', 'event'] as const

type Loaded = { readonly record: NameRecordView; readonly dossier: NameDossier | null }

/**
 * The record tab of the workbench's right column: what the market says about
 * the open name, and everything the user has said about it. The decision chain
 * is the product's own surface — a general agent neither keeps a claim nor
 * comes back to score it — so the tab leads with the stance and the entries
 * still waiting.
 *
 * It carries the name's figures too. The design puts those above the
 * conversation, which belongs to another package; until the centre column can
 * take them, this is where the name's numbers and its record stay together.
 * @param props - the focus, the two reads, the write, and the locale seat.
 * @returns the tab body, or the empty state before a name is opened.
 */
export function RecordPanel({ focus, read, dossier, append, t }: RecordPanelProps): ReactNode {
  const { instrument } = useWorkbenchFocus(focus)
  const [state, setState] = useState<Loaded | 'loading' | 'error'>('loading')
  const [kind, setKind] = useState<(typeof WRITABLE)[number]>('thesis')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (instrument === null) return
    let current = true
    setState('loading')
    void Promise.all([
      read(instrument),
      dossier(instrument, HISTORY_SESSIONS).catch(() => null),
    ]).then(
      ([record, figures]) => { if (current) setState({ record, dossier: figures }) },
      () => { if (current) setState('error') },
    )
    return () => { current = false }
    // The instrument is the identity; its object reference changes per render.
  }, [read, dossier, reload, instrument?.market, instrument?.symbol])

  if (instrument === null) {
    return (
      <div className={css.panel}>
        <div className={css.emptyRecord}>
          <span className={css.emptyIcon}><IconListPenOutline16 size={16} /></span>
          <p>{t('record.noName')}</p>
        </div>
      </div>
    )
  }

  const label = instrumentLabel(instrument)
  const loaded = typeof state === 'object' ? state : null
  const quote = loaded?.dossier?.quote ?? null
  const bars = loaded?.dossier?.bars ?? []

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const text = body.trim()
    if (text.length === 0 || saving) return
    setSaving(true)
    void append(instrument, { kind, body: text, source: { kind: 'manual' } }).then(
      () => {
        setSaving(false)
        setBody('')
        setReload(value => value + 1)
      },
      () => { setSaving(false) },
    )
  }

  const settle = (entry: ChainEntry, verdict: 'confirmed' | 'refuted'): void => {
    void append(instrument, {
      kind: 'verification',
      body: verdict === 'confirmed' ? t('record.settleConfirmed') : t('record.settleRefuted'),
      source: { kind: 'manual' },
      settles: entry.id,
      verdict,
    }).then(() => { setReload(value => value + 1) })
  }

  return (
    <div className={css.panel} aria-busy={state === 'loading'}>
      <div className={css.market}>
        <span className={css.marketLabel}>{t('record.latest')}</span>
        {quote === null ? (
          <span className={css.noQuote}>{t('noQuote')}</span>
        ) : (
          <span className={css.figures}>
            <span className={css.last}>{formatLast(quote)}</span>
            <span className={css.change} data-direction={directionOf(quote.changePercent)}>
              {formatChange(quote.changePercent)}
            </span>
          </span>
        )}
      </div>

      {bars.length === 0 ? null : (
        <section className={css.chartCard} aria-label={t('record.trend')}>
          <div className={css.sectionKicker}>{t('record.trend')}</div>
          <ProChart
            label={label}
            bars={bars}
            adjustment={loaded?.dossier?.adjustment ?? 'none'}
            currency={quote?.currency}
            showLabel={false}
            t={t}
          />
        </section>
      )}

      {state === 'error' ? <p className={css.failure} role="alert">{t('record.failed')}</p> : null}
      {state === 'loading' ? <p className={css.loading}>{t('page.loading')}</p> : null}

      {loaded !== null ? (
        <>
          <dl className={css.stance}>
            <div>
              <dt>{t('record.posture')}</dt>
              <dd>{t(`record.posture.${loaded.record.stance?.posture ?? 'watching'}`)}</dd>
            </div>
            <div>
              <dt>{t('record.position')}</dt>
              <dd>{loaded.record.stance?.positionPercent === null || loaded.record.stance === null
                ? '—'
                : `${loaded.record.stance.positionPercent}%`}</dd>
            </div>
            <div>
              <dt>{t('record.sessions')}</dt>
              <dd>{loaded.record.sessions.length}</dd>
            </div>
          </dl>

          <section className={css.recordSection}>
            <header className={css.recordHead}>
              <div>
                <div className={css.sectionKicker}>{t('record.archive')}</div>
                <h3 className={css.recordTitle}>{t('record.chainTitle')}</h3>
              </div>
              <span className={css.entryCount}>{t('record.entryCount', { count: loaded.record.chain.length })}</span>
            </header>

            <form className={css.compose} onSubmit={submit}>
              <div className={css.composeHead}>
                <span className={css.composeTitle}>{t('record.composeTitle')}</span>
                <span className={css.composeHint}>{t('record.composeHint')}</span>
              </div>
              <div className={css.kinds}>
                {WRITABLE.map(option => (
                  <button
                    key={option}
                    type="button"
                    className={css.kind}
                    data-on={option === kind ? 'true' : undefined}
                    aria-pressed={option === kind}
                    onClick={() => { setKind(option) }}
                  >
                    {t(`record.kind.${option}`)}
                  </button>
                ))}
              </div>
              <textarea
                className={css.body}
                rows={2}
                value={body}
                placeholder={t('record.placeholder')}
                aria-label={t('record.placeholder')}
                onChange={(event) => { setBody(event.currentTarget.value) }}
              />
              <button type="submit" className={css.save} disabled={saving || body.trim().length === 0}>
                <IconPlusOutline16 size={13} />
                {t('record.save')}
              </button>
            </form>

            {loaded.record.chain.length === 0 ? (
              <div className={css.emptyChain}>
                <span className={css.emptyIcon}><IconListPenOutline16 size={16} /></span>
                <p>{t('record.emptyChain')}</p>
              </div>
            ) : (
              <ol className={css.chain}>
                {loaded.record.chain.map(entry => (
                  <li className={css.entry} key={entry.id} data-kind={entry.kind}>
                    <div className={css.when}>
                      <span className={css.date}>{entry.recordedAt.slice(0, 10)}</span>
                      <span className={css.kindTag}>{t(`record.kind.${entry.kind}`)}</span>
                      {entry.kind === 'thesis' && entry.resolution !== 'open' ? (
                        <span className={css.kindTag} data-verdict={entry.resolution}>
                          {t(`record.resolution.${entry.resolution}`)}
                        </span>
                      ) : null}
                    </div>
                    <p className={css.text}>{entry.body}</p>
                    {entry.kind === 'verification' ? (
                      <p className={css.meta}>{t('record.elapsed', { days: entry.elapsedDays })}</p>
                    ) : null}
                    <footer className={css.entryFoot}>
                      <span className={css.meta}>
                        {entry.source.kind === 'manual'
                          ? t('record.fromManual')
                          : t('record.fromSession', { turn: entry.source.turn })}
                      </span>
                      {entry.kind === 'thesis' && entry.resolution === 'open' ? (
                        <div className={css.settle}>
                          <button type="button" data-verdict="confirmed" onClick={() => { settle(entry, 'confirmed') }}>
                            {t('record.confirm')}
                          </button>
                          <button type="button" data-verdict="refuted" onClick={() => { settle(entry, 'refuted') }}>
                            {t('record.refute')}
                          </button>
                        </div>
                      ) : null}
                    </footer>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
