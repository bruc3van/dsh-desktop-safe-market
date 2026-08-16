/**
 * The Marketplace section's nav glyph.
 *
 * The settings shell owns the section rail and picks each row's icon itself,
 * keyed by a hardcoded id switch whose fallback is the settings gear — the
 * `settings.section` slot contract carries no icon option, so a section cannot
 * declare one. What a section CAN recognize is its own label: the shell
 * renders registrant-supplied label text, and this plugin owns both
 * dictionaries' `nav` strings. This module watches for the settings dialog's
 * nav rows, finds the one labeled as ours (either language, so a locale
 * switch mid-session still matches), and re-skins its icon element as the
 * market's storefront — same `<svg>` seat, same shell class, only the glyph
 * changes.
 *
 * Every assumption degrades to the gear, never to a breakage: a shell that
 * restructures its nav simply leaves nothing matched, and a re-render that
 * drops our marker just gets re-skinned on the next pass.
 */
import { en, zh } from './locales.ts'

/** Attribute marking an icon element already re-skinned (React re-renders drop it). */
const MARKER = 'data-dsh-safe-market-icon'

/** The section's nav label in every shipped dictionary. */
const LABELS: ReadonlySet<string> = new Set([zh.nav, en.nav])

/**
 * The storefront: awning with four scallops over a shop body with a door, one
 * even-odd filled path on the shell's own 16×16 grid, `currentColor` like the
 * shell's glyphs.
 */
const STOREFRONT = '<path fill-rule="evenodd" clip-rule="evenodd" fill="currentColor" d="M2.9 2.2h10.2l1.5 3.2a1.65 1.65 0 0 1-3.3 0 1.65 1.65 0 0 1-3.3 0 1.65 1.65 0 0 1-3.3 0 1.65 1.65 0 0 1-3.3 0L2.9 2.2ZM4 7.4h8a.8.8 0 0 1 .8.8v5a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8v-5a.8.8 0 0 1 .8-.8ZM6.8 9.8h2.4v4.2H6.8Z"/>'

/** Re-skin every unmatched nav row labeled as this section, inside any open settings dialog. */
function sweepNav(root: ParentNode): void {
  for (const dialog of root.querySelectorAll('div[role="dialog"]')) {
    for (const button of dialog.querySelectorAll('nav button')) {
      const label = button.lastElementChild
      if (label === null || label.tagName !== 'SPAN' || !LABELS.has(label.textContent?.trim() ?? '')) continue
      const svg = button.querySelector('svg')
      if (svg === null || svg.getAttribute(MARKER) === 'true') continue
      svg.setAttribute(MARKER, 'true')
      svg.innerHTML = STOREFRONT
    }
  }
}

/**
 * Watch for settings dialogs and keep the section's nav row skinned. The
 * panel mounts on open and its rows re-render on ledger bumps (locale
 * switches re-register labels), so the sweep re-runs on document mutations,
 * throttled to one pass per quiet interval; with no dialog open the pass is
 * one empty `querySelectorAll`.
 * @returns a disposer stopping the watch.
 */
export function adoptNavIcon(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => {}
  let scheduled = false
  let disposed = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      // A mutation can land inside the quiet interval of a dispose; the
      // observer is gone by then, so the pass would be one harmless empty
      // scan — skipped anyway.
      if (!disposed) sweepNav(document)
    }, 200)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  sweepNav(document)
  return () => {
    disposed = true
    observer.disconnect()
  }
}
