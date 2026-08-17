import { useId, useState, type ReactNode } from 'react'
import type { Translate, TriggerCondition } from './automation-model.ts'
import css from './AutomationEditor.module.css'

/** What the editor needs. It holds its own draft and writes nothing. */
export interface AutomationEditorProps {
  /** The package's bound translate. */
  t: Translate
  /** Abandon the draft and close the form. */
  onCancel: () => void
}

/** The condition kinds the form offers, in the order a reader meets them. */
const KINDS = ['dayChange', 'windowMove', 'priceLevel'] as const

/** Coverage choices; a price level forces the third and hides the others. */
const SCOPES = ['watchlist', 'holding', 'names'] as const

/** A move has a sign; a level is crossed from one side. The words differ. */
const MOVE_DIRECTIONS = ['up', 'down'] as const
const LEVEL_DIRECTIONS = ['above', 'below'] as const

/**
 * The new-automation form: the condition, what it covers, and how often it may
 * speak. Frequency is on the form rather than behind a default, because a rule
 * with no bound on it is the one that fills a conversation with a threshold
 * being crossed back and forth.
 *
 * A price level holds for one instrument and not for a set, so choosing it
 * fixes the coverage to named instruments rather than letting the reader build
 * a rule that cannot mean anything.
 * @param props - the locale seat and the way out.
 * @returns the form.
 */
export function AutomationEditor({ t, onCancel }: AutomationEditorProps): ReactNode {
  const id = useId()
  const [kind, setKind] = useState<TriggerCondition['kind']>('dayChange')
  const [direction, setDirection] = useState<
    (typeof MOVE_DIRECTIONS)[number] | (typeof LEVEL_DIRECTIONS)[number]
  >('up')
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('watchlist')
  const [interpret, setInterpret] = useState(true)
  const [daily, setDaily] = useState(true)

  const level = kind === 'priceLevel'
  const effectiveScope = level ? 'names' : scope

  return (
    <form
      className={css.editor}
      aria-label={t('editor.title')}
      onSubmit={(event) => { event.preventDefault() }}
    >
      <h2 className={css.title}>{t('editor.title')}</h2>

      <label className={css.field}>
        <span className={css.label}>{t('editor.name')}</span>
        <input className={css.input} type="text" placeholder={t('editor.namePlaceholder')} />
      </label>

      <fieldset className={css.group}>
        <legend className={css.label}>{t('editor.condition')}</legend>
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
                // The two vocabularies do not overlap, so switching between a
                // move and a level has to reset the direction rather than
                // carry a word the new condition cannot use.
                setDirection(option === 'priceLevel' ? 'below' : 'up')
              }}
            >
              {t(`editor.kind.${option}`)}
            </button>
          ))}
        </div>

        <div className={css.params}>
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
          </div>
          {kind === 'windowMove' ? (
            <label className={css.inline}>
              <span className={css.inlineLabel}>{t('editor.window')}</span>
              <input className={css.number} type="number" defaultValue={5} min={1} />
            </label>
          ) : null}
          {level ? (
            <label className={css.inline}>
              <span className={css.inlineLabel}>{t('editor.price')}</span>
              <input className={css.number} type="number" defaultValue={1600} step={0.01} />
            </label>
          ) : (
            <label className={css.inline}>
              <span className={css.inlineLabel}>{t('editor.threshold')}</span>
              <input className={css.number} type="number" defaultValue={3} step={0.1} min={0} />
            </label>
          )}
        </div>
      </fieldset>

      <fieldset className={css.group}>
        <legend className={css.label}>{t('editor.scope')}</legend>
        <div className={css.choices} role="group">
          {SCOPES.map(option => (
            <button
              key={option}
              type="button"
              className={css.choice}
              data-on={option === effectiveScope ? 'true' : undefined}
              aria-pressed={option === effectiveScope}
              disabled={level && option !== 'names'}
              onClick={() => { setScope(option) }}
            >
              {t(`editor.scope.${option}`)}
            </button>
          ))}
        </div>
        {level ? <p className={css.hint}>{t('editor.scopeNamesHint')}</p> : null}
      </fieldset>

      <fieldset className={css.group}>
        <legend className={css.label}>{t('editor.throttle')}</legend>
        <div className={css.choices} role="group">
          <button
            type="button"
            className={css.choice}
            data-on={daily ? 'true' : undefined}
            aria-pressed={daily}
            onClick={() => { setDaily(true) }}
          >
            {t('editor.throttle.daily')}
          </button>
          <button
            type="button"
            className={css.choice}
            data-on={daily ? undefined : 'true'}
            aria-pressed={!daily}
            onClick={() => { setDaily(false) }}
          >
            {t('editor.throttle.cooldown')}
          </button>
          <label className={css.inline}>
            <span className={css.inlineLabel}>{t('editor.cap')}</span>
            <input className={css.number} type="number" defaultValue={20} min={1} />
          </label>
        </div>
      </fieldset>

      <label className={css.check} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={interpret}
          onChange={(event) => { setInterpret(event.currentTarget.checked) }}
        />
        <span>{t('editor.interpret')}</span>
      </label>

      <footer className={css.foot}>
        <span className={css.disabledNote}>{t('editor.disabled')}</span>
        <div className={css.footActions}>
          <button type="button" className={css.ghost} onClick={onCancel}>{t('editor.cancel')}</button>
          <button type="submit" className={css.save} disabled>{t('editor.save')}</button>
        </div>
      </footer>
    </form>
  )
}
