// What Android's system back does on a settings editor (SettingsEditorFrame) with unsaved changes.
// The shell's Overlays are one list for every screen, so the editor's "ask before leaving" guard
// must only be registered while the editor is its tab's top screen: with a screen pushed over it
// (the Access gates page's gate entries screens: list, pick, value), back pops that screen, one
// step at a time, and asks "Discard changes?" only when it would leave the editor itself.

export type EditorBackState = {
    /** The editor is its tab's top screen (`context.onTop()`). */
    onTop: boolean;
    /** The draft has something a save would send. */
    changed: boolean;
    /** "Discard changes?" is showing (it's an overlay of its own, which back closes). */
    discarding: boolean;
    /** A save is on its way. */
    busy: boolean;
};

/** Whether the editor's guard is registered: back then asks "Discard changes?" rather than leave. */
export function guardsLeaving(state: EditorBackState): boolean {
    return state.onTop && state.changed && !state.discarding && !state.busy;
}
