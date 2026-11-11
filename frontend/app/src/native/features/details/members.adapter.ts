import type { MemberTab } from "@client";

// The Members screen's tabs as the screen shows them (native plan 10): each tab's label and its
// search's placeholder, and the count on Lapsed while anyone has lapsed. Which tabs show is
// @client's `memberTabs`.

export const MEMBER_TAB_LABELS: Record<MemberTab, string> = {
    members: "native.details.members.tabs.members",
    lapsed: "native.details.members.tabs.lapsed",
    blocked: "native.details.members.tabs.blocked",
};

/** The search's placeholder follows the tab ("Search members / lapsed / blocked"). */
export const MEMBER_TAB_SEARCH: Record<MemberTab, string> = {
    members: "native.details.members.search",
    lapsed: "native.details.members.searchLapsed",
    blocked: "native.details.members.searchBlocked",
};

/** The tabs' counts (SegmentedTabs' `counts`): Lapsed's, while anyone has lapsed; none on the others. */
export function memberTabCounts(tabs: MemberTab[], lapsed: number): (number | null)[] {
    return tabs.map((tab) => (tab === "lapsed" && lapsed > 0 ? lapsed : null));
}

/**
 * The tab shown for the one `chosen`: it while it's among `tabs`, else Members. The screen then
 * makes Members the one chosen, so a tab that goes (the gates taken away, a role lost) doesn't come
 * back by itself if it returns.
 */
export function keptTab(chosen: MemberTab, tabs: MemberTab[]): MemberTab {
    return tabs.includes(chosen) ? chosen : "members";
}
