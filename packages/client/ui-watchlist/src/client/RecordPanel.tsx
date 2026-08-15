import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type {
  ChainEntry,
  ChainEntryRequest,
  InstrumentRef,
  NameDossier,
  NameRecordView,
} from '@deepseek-ai/dsh-api-remotes/client'
import { PriceSeriesBlock, priceSeriesModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { directionOf, formatChange, formatLast, instrumentLabel } from './watchlist-model.ts'
import { useWorkbenchFocus, type WorkbenchSelection } from './workbench-store.ts'
import css from './RecordPanel.module.css'

/** Registration-side face the record panel calls through. */
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

/** Full props of the workbench's right column. */
export type RecordPanelProps =
  PropsRuntime<'details'>
  & PropsLocale<'watchlist'>
  & RecordPanelInjected

/** Sessions of history the header chart draws; the seam bounds anything larger. */
const HISTORY_SESSIONS = 60

/** The kinds a user writes by hand. A verification settles a thesis, so it is offered per thesis. */
const WRITABLE = ['thesis', 'decision', 'event'] as const

type Loaded = { readonly record: NameRecordView; readonly dossier: NameDossier | null }

/**
 * The workbench's right column: what the market says about the open name, and
 * everything the user has said about it. The decision chain is the product's
 * own surface — a general agent neither keeps a claim nor comes back to score
 * it — so the panel leads with the stance and the entries still waiting.
 *
 * It carries the name's figures too. The design puts those above the
 * conversation, which belongs to another package; until the centre column can
 * take them, the panel is where the name's numbers and its record stay
 * together.
 * @param props - the focus, the two reads, the write, and the locale seat.
 * @returns the column, or the empty state before a name is opened.
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
        <p className={css.note}>{t('record.noName')}</p>
      </div>
    )
  }

  const label = instrumentLabel(instrument)
  const loaded = typeof state === 'object' ? state : null
  const quote = loaded?.dossier?.quote ?? null
  const bars = loaded?.dossier?.bars ?? []
  const chart = bars.length === 0
    ? null
    : priceSeriesModel({
      label,
      bars,
      adjustment: loaded?.dossier?.adjustment ?? 'none',
      currency: quote?.currency,
    })

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
      <header className={css.head}>
        <h2 className={css.title}>{label}</h2>
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
      </header>

      {chart !== null ? <div className={css.chart}><PriceSeriesBlock model={chart} /></div> : null}

      {state === 'error' ? <p className={css.failure} role="alert">{t('record.failed')}</p> : null}

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

          <form className={css.compose} onSubmit={submit}>
            <div className={css.kinds}>
              {WRITABLE.map(option => (
                <button
                  key={option}
                  type="button"
                  className={css.kind}
                  data-on={option === kind ? 'true' : undefined}
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
              {t('record.save')}
            </button>
          </form>

          {loaded.record.chain.length === 0 ? (
            <p className={css.note}>{t('record.emptyChain')}</p>
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
                  <p className={css.meta}>
                    {entry.source.kind === 'manual'
                      ? t('record.fromManual')
                      : t('record.fromSession', { turn: entry.source.turn })}
                  </p>
                  {entry.kind === 'thesis' && entry.resolution === 'open' ? (
                    <div className={css.settle}>
                      <button type="button" onClick={() => { settle(entry, 'confirmed') }}>
                        {t('record.confirm')}
                      </button>
                      <button type="button" onClick={() => { settle(entry, 'refuted') }}>
                        {t('record.refute')}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </div>
  )
}
