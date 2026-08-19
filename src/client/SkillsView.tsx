/**
 * The Skills page of the marketplace section: what the current session can
 * actually resolve right now.
 *
 * Read-only, and it needs neither the market switch nor the network. It is
 * addressed by the open session because skill discovery is layered by the
 * agent preset that session runs — a deployment-wide read would report "none"
 * to a user with plenty. Incomplete discovery is shown rather than smoothed
 * over: a short list that looks whole is a wrong answer, not a tidy one.
 */
import { useEffect, useState, type ReactElement } from 'react'
import type { MarketSkill, MarketSkillsResult } from '../contract.ts'
import type { MarketLocale } from './copy.ts'

/** The reader's sentinel for "nothing to address" (see client/index.ts). */
export const NO_SESSION = 'no-session'

/** The reader's sentinel for "the session list has not landed yet". */
export const SESSIONS_PENDING = 'sessions-pending'

/** Loading, failed, or answered. */
type SkillsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: MarketSkillsResult }
  | { readonly status: 'error'; readonly message: string }

/** Whether one skill survives the current query. */
function matches(skill: MarketSkill, query: string): boolean {
  if (query === '') return true
  const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.provider}`.toLocaleLowerCase()
  return query.split(/\s+/).every(word => haystack.includes(word))
}

/** The Skills page. */
export function SkillsView({ t, listSkills }: {
  t: MarketLocale
  listSkills: () => Promise<MarketSkillsResult>
}): ReactElement {
  const [state, setState] = useState<SkillsState>({ status: 'loading' })
  const [query, setQuery] = useState('')

  useEffect(() => {
    let live = true
    void listSkills().then((result) => {
      if (live) setState({ status: 'ready', result })
    }, (error: unknown) => {
      if (live) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { live = false }
  }, [listSkills])

  const result = state.status === 'ready' ? state.result : null
  const shown = result === null
    ? []
    : result.skills.filter(skill => matches(skill, query.trim().toLocaleLowerCase()))

  return (
    <div className="dsh_market_page">
      <div className="dsh_market_intro">
        <p className="dsh_market_introTitle">{t('skills.title')}</p>
        <p className="dsh_market_introBody">{t('skills.body')}</p>
      </div>

      {result !== null && result.skills.length > 0 && (
        <div className="dsh_market_bar">
          <input
            className="dsh_market_search"
            type="search"
            spellCheck={false}
            placeholder={t('skills.search')}
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
          />
        </div>
      )}

      {state.status === 'loading' || (result !== null && result.error === SESSIONS_PENDING)
        ? (
          <div className="dsh_market_notice" aria-busy="true" aria-live="polite">
            <p className="dsh_market_noticeBody">{t('skills.loading')}</p>
          </div>
          )
        : (
          <p className="dsh_market_status" data-error={state.status === 'error' || (result !== null && result.error !== '' && result.error !== NO_SESSION) ? 'true' : undefined}>
            {state.status === 'error'
              ? t('skills.failed', { reason: state.message })
              : result !== null && result.error === NO_SESSION
                ? t('skills.noSession')
                : result !== null && result.error !== ''
                  ? t('skills.failed', { reason: result.error })
                  : shown.length === 0
                    ? t('skills.empty')
                    : t('skills.count', { count: String(shown.length) })}
          </p>
          )}

      {result !== null && !result.complete && result.error === '' && (
        <p className="dsh_market_status" data-error="true">{t('skills.incomplete')}</p>
      )}

      {shown.length > 0 && (
        <ul className="dsh_market_cards">
          {shown.map(skill => (
            <li key={skill.name} className="dsh_market_card">
              <div className="dsh_market_head">
                <span className="dsh_market_name" title={skill.name}>{skill.name}</span>
              </div>
              <p className="dsh_market_meta">
                {[
                  t('skills.provider', { provider: skill.provider }),
                  skill.modelInvocable ? t('skills.model') : '',
                  skill.userInvocable ? t('skills.user') : '',
                ].filter(part => part !== '').join(' · ')}
              </p>
              {skill.description !== '' && <p className="dsh_market_desc">{skill.description}</p>}
              {skill.whenToUse !== '' && <p className="dsh_market_meta">{skill.whenToUse}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
