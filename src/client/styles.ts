/**
 * The market tab's stylesheet, hand-written as a template string and injected
 * once by the plugin body: the web server serves exactly one file per client
 * plugin, so no separate CSS artifact may exist. Colors come only from the
 * shared `--dsw-alias-*` design platform (no literal values), so the tab
 * follows the appearance setting with the rest of Settings; class names carry
 * the `dsh_market` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-desktop-safe-market-style'

/** The market tab's injected stylesheet text. */
export const cssText = `
.dsh_market_tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px;
  color: var(--dsw-alias-label-primary);
}

/* The off state: one card that explains itself and asks. */
.dsh_market_intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_introTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.dsh_market_introBody,
.dsh_market_disclaimer {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_disclaimer {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh_market_introActions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.dsh_market_bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh_market_search {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.dsh_market_search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_search:focus-visible {
  border-color: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
}

.dsh_market_ghost {
  flex: none;
  white-space: nowrap;
  padding: 7px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 28px;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color .15s ease;
}
.dsh_market_ghost:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_ghost:disabled {
  cursor: default;
  opacity: .55;
}

.dsh_market_primary {
  flex: none;
  white-space: nowrap;
  padding: 7px 16px;
  border: 1px solid var(--dsw-alias-label-primary);
  border-radius: 28px;
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-1);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: opacity .15s ease;
}
.dsh_market_primary:hover:not(:disabled) {
  opacity: .88;
}
.dsh_market_primary:disabled {
  cursor: default;
  opacity: .55;
}

.dsh_market_chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh_market_chip {
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh_market_chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_chip[data-on="true"] {
  border-color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-1);
}

.dsh_market_status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_status[data-error="true"] {
  color: var(--dsw-alias-state-error-primary);
}

.dsh_market_cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsh_market_card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh_market_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.dsh_market_stars {
  flex: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
/* Two cards to a row leaves about 250px of text width, which is not enough
   for category, owner, language, licence and date on one line — so this line
   wraps rather than ending in an ellipsis that hides the licence. */
.dsh_market_meta {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 2px;
}
.dsh_market_link {
  flex: none;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  text-decoration: none;
}
.dsh_market_link:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_market_install {
  flex: none;
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-label-primary);
  border-radius: 999px;
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-1);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: opacity .15s ease;
}
.dsh_market_install:hover:not(:disabled) {
  opacity: .88;
}
.dsh_market_install:disabled {
  cursor: default;
  opacity: .55;
}
/* The confirmation replaces the row's actions, so the card reports what
   happened where the button that caused it was. */
.dsh_market_staged {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: auto;
  padding-top: 6px;
  font-size: 12px;
  line-height: 18px;
}
.dsh_market_stagedTitle {
  color: var(--dsw-alias-state-business-primary);
}
.dsh_market_stagedHint,
.dsh_market_cardError {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_cardError {
  color: var(--dsw-alias-state-error-primary);
}

.dsh_market_note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_note a {
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
`

/**
 * Inject the stylesheet once. Idempotent: a second call (HMR, a re-applied
 * plugin) finds its own tag and leaves it alone.
 */
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = cssText
  document.head.appendChild(tag)
}
