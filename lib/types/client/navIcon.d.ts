/**
 * Watch for settings dialogs and keep the section's nav row skinned. The
 * panel mounts on open and its rows re-render on ledger bumps (locale
 * switches re-register labels), so the sweep re-runs on document mutations,
 * throttled to one pass per quiet interval; with no dialog open the pass is
 * one empty `querySelectorAll`.
 * @returns a disposer stopping the watch.
 */
export declare function adoptNavIcon(): () => void;
