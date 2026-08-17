import { useState, type ReactNode } from 'react'
import type { InstrumentRef } from '@deepseek-ai/dsh-api-remotes/client'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  covers, type Automation, type Translate, type TriggerCondition,
} from './automation-model.ts'
import css from './AttachPanel.module.css'

/** What the panel needs. It holds its own draft and writes nothing. */
export interface AttachPanelProps {
  /** Whether the panel is showing. */
  open: boolean
  /** The name being attached to. */
  instrument: InstrumentRef
  /** That name as the surface that opened this knows it. */
  displayName: string
  /** Every rule, so the joinable ones can be offered. */
  automations: readonly Automation[]
  /** The package's bound translate. */
  t: Translate
  /** Dismiss without attaching. */
  onClose: () => void
}

/** The condition kinds the inline form offers. */
const KINDS = ['dayChange', 'windowMove', 'priceLevel'] as const

/** A move has a sign; a level is crossed from one side. The words differ. */
const MOVE_DIRECTIONS = ['up', 'down'] as const
const LEVEL_DIRECTIONS = ['above', 'below'] as const

/**
 * Attaching one name to automations, from that name's own side.
 *
 * Coverage is the only association a rule has, and it runs rule-to-name: a
 * rule says which names it watches. Reaching it from a name therefore means
 * one of two things, and the panel offers both, because offering only the
 * second turns one condition over ten names into ten rules.
 *
 * **Join an existing rule** — the named-instrument rules this name is not
 * already in; checking one adds the name to that rule's coverage. Rules scoped
 * to the whole watchlist or to holdings are not offered: they already decide
 * their own membership, and a name added by hand would contradict the scope
 * that resolves them.
 *
 * **Create one that watches only this name** — the condition form, with the
 * coverage fixed to this instrument rather than asked for.
 * @param props - the name, the rules, the locale seat, and the way out.
 * @returns the modal.
 */
export function AttachPanel({
  open, instrument, displayName, automations, t, onClose,
}: AttachPanelProps): ReactNode {
  const [joined, setJoined] = useState<readonly string[]>([])
  const [kind, setKind] = useState<TriggerCondition['kind']>('dayChange')
  const [direction, setDirection] = useState<
    (typeof MOVE_DIRECTIONS)[number] | (typeof LEVEL_DIRECTIONS)[number]
  >('up')
  const [interpret, setInterpret] = useState(true)

  // Only a named-instrument rule has a coverage a person edits. A watchlist or
  // holdings rule resolves its own members, so joining one by hand would set a
  // membership its scope recomputes away.
  const joinable = automations.filter(automation =>
    automation.scope.kind === 'names' && !covers(automation, instrument))
  const level = kind === 'priceLevel'

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('attach.cancel')}
      title={t('attach.title', { name: displayName })}
      description={t('attach.description')}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>{t('attach.cancel')}</Button>
          <Button variant="outline" disabled>{t('attach.save')}</Button>
        </>
      )}
    >
      <div className={css.body}>
        <section className={css.block}>
          <h3 className={css.blockTitle}>{t('attach.join')}</h3>
          {joinable.length === 0 ? (
            <p className={css.quiet}>{t('attach.joinEmpty')}</p>
          ) : (
            <ul className={css.joinList}>
              {joinable.map(automation => (
                <li key={automation.id}>
                  <label className={css.join}>
                    <input
                      type="checkbox"
                      checked={joined.includes(automation.id)}
                      onChange={(event) => {
                        setJoined(current => event.currentTarget.checked
                          ? [...current, automation.id]
                          : current.filter(id => id !== automation.id))
                      }}
                    />
                    <span className={css.joinName}>{automation.name}</span>
                    <span className={css.joinCount}>
                      {t('attach.joinCovers', { count: automation.covers.length })}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={css.block}>
          <h3 className={css.blockTitle}>{t('attach.create', { name: displayName })}</h3>
          <div className={css.row}>
            <span className={css.label}>{t('editor.condition')}</span>
            <div className={css.choices} role="group">
              {KINDS.map(option => (
                <button
                  key={option}
                  type="button"
                  className={css.choice}
                  data-on={option === kind ? 'true' : undefined}
                  aria-pressed={option === kind}
                  onClick={() => {
                    setKind(option)
                    setDirection(option === 'priceLevel' ? 'below' : 'up')
                  }}
                >
                  {t(`editor.kind.${option}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={css.row}>
            <span className={css.label}>{t('attach.parameters')}</span>
            <div className={css.choices} role="group">
              {(level ? LEVEL_DIRECTIONS : MOVE_DIRECTIONS).map(option => (
                <button
                  key={option}
                  type="button"
                  className={css.choice}
                  data-on={option === direction ? 'true' : undefined}
                  aria-pressed={option === direction}
                  onClick={() => { setDirection(option) }}
                >
                  {t(`editor.direction.${option}`)}
                </button>
              ))}
              {kind === 'windowMove' ? (
                <label className={css.inline}>
                  <span className={css.inlineLabel}>{t('editor.window')}</span>
                  <input className={css.number} type="number" defaultValue={5} min={1} />
                </label>
              ) : null}
              <label className={css.inline}>
                <span className={css.inlineLabel}>{level ? t('editor.price') : t('editor.threshold')}</span>
                <input
                  className={css.number}
                  type="number"
                  defaultValue={level ? 1600 : 3}
                  step={level ? 0.01 : 0.1}
                />
              </label>
            </div>
          </div>

          <label className={css.check}>
            <input
              type="checkbox"
              checked={interpret}
              onChange={(event) => { setInterpret(event.currentTarget.checked) }}
            />
            <span>{t('editor.interpret')}</span>
          </label>
        </section>

        <p className={css.disabledNote}>{t('editor.disabled')}</p>
      </div>
    </Modal>
  )
}
