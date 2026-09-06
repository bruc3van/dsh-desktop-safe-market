import { useEffect, useRef, useState } from 'react'
import type { ReviewMode } from './reviewMode.ts'
import type { MarketLocale } from './copy.ts'

const modes: ReviewMode[] = ['compact', 'full']

export function ReviewSelector({ id, describedBy, value, disabled, onChange, t }: {
  id: string
  describedBy: string
  value: ReviewMode
  disabled: boolean
  onChange: (mode: ReviewMode) => void
  t: MarketLocale
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    items.current[modes.indexOf(value)]?.focus()
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, value])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  return (
    <div className="dsh_market_reviewSelector" ref={root}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <button ref={trigger} id={id} type="button" className="dsh_market_reviewSelect"
        aria-label={`${t('review.label')}: ${t(value === 'full' ? 'review.full' : 'review.compact')}`}
        aria-describedby={describedBy} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined} disabled={disabled}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}>
        {t(value === 'full' ? 'review.full' : 'review.compact')}
        <svg className="dsh_market_reviewChevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div id={`${id}-menu`} className="dsh_market_reviewMenu" role="menu" aria-label={t('review.label')}
        onKeyDown={event => {
          const index = items.current.indexOf(document.activeElement as HTMLButtonElement)
          let next: number | undefined
          if (event.key === 'ArrowDown') next = (index + 1) % modes.length
          if (event.key === 'ArrowUp') next = (index + modes.length - 1) % modes.length
          if (event.key === 'Home') next = 0
          if (event.key === 'End') next = modes.length - 1
          if (next !== undefined) { event.preventDefault(); items.current[next]?.focus() }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
            trigger.current?.focus()
          }
        }}>
        {modes.map((mode, index) => <button key={mode} type="button" role="menuitemradio"
          ref={element => { items.current[index] = element }} tabIndex={-1}
          className="dsh_market_reviewOption" aria-checked={value === mode}
          onClick={() => { onChange(mode); setOpen(false); trigger.current?.focus() }}>
          {t(mode === 'full' ? 'review.full' : 'review.compact')}
          {value === mode && <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="m3 9 4 4 8-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
        </button>)}
      </div>}
    </div>
  )
}
