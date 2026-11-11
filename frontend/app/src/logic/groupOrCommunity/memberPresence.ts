// Whose online status a group's, channel's or community's panel (GroupPanel) looks up on the app's
// clock (OnlineUsers): only the members it shows presence for, as it shows it.
//
// - The quick panel's main page is built around who's online now: its count is over all the
//   members, so it needs every one of them.
// - The full panel's Members page shows every member's row with its dot (the list isn't
//   virtualised, so every row is rendered).
// - Every other page shows nobody's presence: the full panel's overview lists a few members without
//   a dot, and bots, rules, permissions, pinned messages and the rest show no members at all.

/** The panel's page: GroupPanel's view as it last reported it (none yet is its main page). */
export type PanelPresenceView = {
    view: string | undefined;
    /** The right column's compact panel, whose main page is its online card. */
    quick: boolean;
};

export function membersWithPresenceShown(
    panel: PanelPresenceView,
    memberIds: readonly string[],
): readonly string[] {
    const view = panel.view ?? "main";
    const shown = panel.quick ? view === "main" : view === "members";
    return shown ? memberIds : [];
}
