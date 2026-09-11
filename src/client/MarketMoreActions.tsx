import { useEffect, useRef, type ReactNode } from 'react'

/** Native disclosure keeps normal Tab navigation for links and actions. */
export function MarketMoreActions({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) {
        root.current.open = false
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  return <details className="dsh_market_more" ref={root}
    onKeyDown={event => {
      if (event.key === 'Escape' && root.current?.open) {
        event.preventDefault()
        event.stopPropagation()
        root.current.open = false
        root.current.querySelector('summary')?.focus()
      }
    }}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
    }}>
    <summary className="dsh_market_headerAction dsh_market_moreTrigger" aria-label={label} title={label}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
      </svg>
    </summary>
    <div className="dsh_market_morePanel" onClick={event => {
      const action = event.target instanceof Element ? event.target.closest('a,button') : null
      if (action && !action.hasAttribute('disabled') && root.current) {
        root.current.open = false
        root.current.querySelector('summary')?.focus()
      }
    }}>{children}</div>
  </details>
}
