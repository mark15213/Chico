import { useState, type ReactNode } from 'react'
import type { UseConversationSession } from '@deepseek-ai/dsh-client-runtime/client'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  attributionModel, compactStamp, sameAttribution, type SourceCitation,
} from './attribution-model.ts'
import css from './AttributionPanel.module.css'

/** Props of the evidence column: the conversation to attribute and the locale seat. */
export type AttributionPanelProps = {
  /** Selector hook over the conversation this panel attributes. */
  useSession: UseConversationSession
} & PropsLocale<'watchlist'>

/** Translate bound to this package's namespace, as the locale seat supplies it. */
type Translate = AttributionPanelProps['t']

/** The two time facts a row states, each labelled and never silently omitted. */
function Timings({ citation, t }: { citation: SourceCitation; t: Translate }): ReactNode {
  const observed = citation.observedAt
  const retrieved = citation.retrievedAt
  return (
    <p className={css.meta}>
      <span>
        {t('evidence.observedAt')}
        {' '}
        {observed === null
          ? <span className={css.absent}>{t('evidence.absent')}</span>
          : <time dateTime={observed}>{compactStamp(observed)}</time>}
      </span>
      <span>
        {t('evidence.retrievedAt')}
        {' '}
        {retrieved === null
          ? <span className={css.absent}>{t('evidence.retrievedNever')}</span>
          : <time dateTime={retrieved}>{compactStamp(retrieved)}</time>}
      </span>
    </p>
  )
}

/**
 * One source row: what it is, where it came from, when, and the original text
 * behind the disclosure. The original stays collapsed because a column showing
 * every fetched page at once is a column nobody can scan.
 */
function Citation({ citation, t }: { citation: SourceCitation; t: Translate }): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <li className={css.citation} data-kind={citation.kind} data-failed={citation.failed || undefined}>
      <div className={css.head}>
        <span className={css.kind}>{t(`evidence.kind.${citation.kind}`)}</span>
        <span className={css.subject} title={citation.subject}>{citation.subject}</span>
        {citation.failed ? <span className={css.failed}>{t('evidence.failed')}</span> : null}
      </div>
      <p className={css.meta}>
        <span>
          {t('evidence.provider')}
          {' '}
          {citation.provider === null
            ? <span className={css.absent}>{citation.tool}</span>
            : <span className={css.provider}>{citation.provider}</span>}
        </span>
        {citation.datasets.length > 0
          ? <span>{t('evidence.datasets')} {citation.datasets.join(', ')}</span>
          : null}
      </p>
      <Timings citation={citation} t={t} />
      {citation.references.length > 0 && (
        <ul className={css.references}>
          {citation.references.map(reference => (
            <li key={reference.url}>
              <a href={reference.url} target="_blank" rel="noreferrer noopener">{reference.title}</a>
              {reference.publishedAt !== null && (
                <span className={css.published}> · {compactStamp(reference.publishedAt)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={css.disclose}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        {open ? t('evidence.close') : t('evidence.open')}
      </button>
      {open && (
        <CodeBlock
          className={css.original}
          code={citation.text}
          copyLabel={t('evidence.copy')}
          copiedLabel={t('evidence.copied')}
        />
      )}
    </li>
  )
}

/**
 * The investing frame's evidence column: for every question in this
 * conversation, the external sources its answer drew on and the original text
 * each one returned.
 *
 * Exchanges read newest first, because the answer a reader is checking is the
 * one they just received. An exchange with no sources keeps its row and says
 * so: an answer built without external data is the model's own, and a panel
 * that hid those would report only the grounded half of the conversation.
 * @param props - the conversation hook and the locale seat.
 * @returns the evidence column.
 */
export function AttributionPanel({ useSession, t }: AttributionPanelProps): ReactNode {
  const exchanges = useSession(attributionModel, sameAttribution)
  const total = exchanges.reduce((count, exchange) => count + exchange.citations.length, 0)

  if (exchanges.length === 0) {
    return (
      <div className={css.panel}>
        <p className={css.note}>{t('evidence.noConversation')}</p>
      </div>
    )
  }

  return (
    <div className={css.panel}>
      <p className={css.summary}>{t('evidence.count', { count: total })}</p>
      <ol className={css.exchanges}>
        {exchanges.map(exchange => (
          <li className={css.exchange} key={exchange.seq}>
            <p className={css.question}>
              {exchange.question === ''
                ? <span className={css.absent}>{t('evidence.unlabelled')}</span>
                : exchange.question}
            </p>
            {exchange.citations.length === 0 ? (
              <p className={css.note}>{t('evidence.noSources')}</p>
            ) : (
              <ul className={css.citations}>
                {exchange.citations.map(citation => (
                  <Citation key={citation.callId} citation={citation} t={t} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
