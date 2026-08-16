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
 * market's storefront — same `<svg>` seat, same shell class, same line weight
 * as the rail's other glyphs; only the glyph changes.
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
 * The line weight the shell's own glyphs carry.
 *
 * They are drawn as FILLED outline paths rather than stroked ones (a Figma
 * export habit), so the weight is not written anywhere as a number — it is
 * the distance between each shape's outer and inner wall. Measured off one of
 * the shell's rounded rectangles, whose outer edge sits at 0.5228 and inner
 * wall at 1.8872: 1.36 on the 16×16 grid. A stroked path of that width is
 * indistinguishable from their fill-drawn outlines and is far easier to keep
 * honest than hand-authoring the inner wall of every curve.
 */
const STROKE = 1.35

/**
 * The storefront: a four-scallop awning over a shop body with a door, drawn
 * as open outlines on the shell's own 16×16 grid in `currentColor`.
 *
 * Outlines, not the solid silhouette this started as. The section rail is a
 * column of thin line glyphs, and a filled mass beside them reads as the
 * selected row even when it is not — the icon has to carry the same weight as
 * its neighbours before it can carry a meaning of its own. The scallops stay
 * because they are what makes the shape a market rather than a house.
 */
const STOREFRONT = `<g fill="none" stroke="currentColor" stroke-width="${String(STROKE)}" stroke-linejoin="round" stroke-linecap="round">`
  // The awning: a flat top, sloped sides, and a scalloped hem. Each scallop
  // is a half-circle of a quarter of the hem's width, so the four together
  // span it exactly and the shape closes on its own left edge.
  + '<path d="M3.05 2.2H12.95L14.35 5.2a1.5875 1.5875 0 0 1-3.175 0 1.5875 1.5875 0 0 1-3.175 0'
  + ' 1.5875 1.5875 0 0 1-3.175 0 1.5875 1.5875 0 0 1-3.175 0Z"/>'
  // The body, open at the top: the awning already closes it, and a second
  // line there would double the weight along the busiest edge.
  + '<path d="M3.1 6.9v5.8a1.1 1.1 0 0 0 1.1 1.1h7.6a1.1 1.1 0 0 0 1.1-1.1V6.9"/>'
  // The door, open at the bottom for the same reason.
  + '<path d="M6.5 13.8V10.2h3v3.6"/>'
  + '</g>'

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
