import {
    i18nKey,
    isCompositeGate,
    isLocked,
    isPreviewingCommunity,
    isUniquePersonGate,
    stripSuspendedGate,
    type AccessGate,
    type CommunitySummary,
    type EnhancedAccessGate,
    type MultiUserChat,
    type ResourceKey,
} from "@client";
import type { JoinTarget } from "./joinFlow.svelte";

// What the bar in place of a preview's composer says and offers (the design's CommunityPreviewBar,
// used for a group or channel preview too): what's previewed, whether joining has requirements,
// Join (or Rejoin, Locked, Sign in to join) and Back. Every tree can use it; the web tree does.

/** The bar's look: preview (Join), gated (Review and join), guest (Sign in to join). */
export type PreviewBarState = "preview" | "gated" | "guest";

/**
 * Back: to where the community's preview was opened from (Explore: the bar's own "Back to
 * Explore"), back to the list, or none (a lapsed member is still a member, so there's nothing to
 * cancel: the old desktop footer hid Leave for them).
 */
export type PreviewBack = "explore" | "back" | "none";

export type PreviewBar = {
    target: JoinTarget;
    /** What the bar names: the chat, or the community whose bar a channel of it shows. */
    name: string;
    /** The community whose bar it is, for a channel of a community being previewed. */
    community: CommunitySummary | undefined;
    state: PreviewBarState;
    /** gated: how many requirements joining has that the user doesn't meet yet. */
    requirements: number;
    /** In place of the bar's own hint for its state; none keeps it. */
    hint: ResourceKey | undefined;
    /** In place of the bar's own Join label for its state; none keeps it. */
    joinLabel: ResourceKey | undefined;
    back: PreviewBack;
    /** A locked gate: Join can't be pressed. */
    locked: boolean;
};

export type PreviewBarInput = {
    /** The group or channel being previewed. */
    chat: MultiUserChat;
    /** Its community, for a channel. */
    community: CommunitySummary | undefined;
    /** The chat, or its community, has lapsed (`client.isLapsed`). */
    lapsed: boolean;
    /**
     * The gates joining the chat asks for (`client.accessGatesForChat(chat, true)`: those an
     * invitation bypasses left out): its community's, then its own.
     */
    gates: EnhancedAccessGate[];
    guest: boolean;
    /** The community whose preview was opened from Explore (`setCommunityPreviewOrigin`). */
    originCommunityId: string | undefined;
    /** Whether the user meets a gate from what the client knows (`client.doesUserMeetAccessGate`). */
    meets: (gate: AccessGate) => boolean;
};

/** Whether a community is being previewed: not joined, or lapsed (`isPreviewingCommunity`). */
export function previewingCommunity(community: CommunitySummary | undefined): boolean {
    return community !== undefined && isPreviewingCommunity(community);
}

/**
 * Whether joining a community asks anything of the user: it has a gate (a lone suspended
 * unique-person gate is none) and they weren't invited (an invitation bypasses it).
 */
export function communityGatesInEffect(community: CommunitySummary | undefined): boolean {
    return (
        community !== undefined &&
        stripSuspendedGate(community.gateConfig.gate).kind !== "no_gate" &&
        !community.isInvited
    );
}

/**
 * How many requirements some gates have that the user doesn't meet (`meets`; `() => false` counts
 * them all). An "any" gate is one requirement however many ways in it has, and none once one is
 * met; an "all" gate is each of its leaves not met yet. The suspended unique-person gate is never
 * asked for, so it's none.
 */
export function requirementCount(
    gates: AccessGate[],
    meets: (gate: AccessGate) => boolean,
): number {
    return gates.map(stripSuspendedGate).reduce((n, g) => {
        if (g.kind === "no_gate" || meets(g)) return n;
        if (!isCompositeGate(g)) return n + 1;
        if (g.operator === "or") return n + 1;
        return n + g.gates.filter((l) => !isUniquePersonGate(l) && !meets(l)).length;
    }, 0);
}

/**
 * The bar for a preview. A channel of a community being previewed (or lapsed) shows the
 * community's bar (its name, "Join community", Back cancelling the community's preview), but Join
 * joins the channel, as the old footers did: the backend joins the community with it, and the gate
 * dialog asks for both levels' requirements, the community's first. Otherwise it's the group's or
 * channel's.
 */
export function previewBar(input: PreviewBarInput): PreviewBar {
    const { chat, community, guest, gates, meets } = input;
    const ofCommunity = chat.kind === "channel" && previewingCommunity(community);
    const level = ofCommunity ? "community" : chat.level;
    const lapsed = ofCommunity ? community?.membership.lapsed === true : input.lapsed;
    const locked = gates.some((g) => isLocked(g));
    const count = requirementCount(gates, meets);
    const state: PreviewBarState = guest ? "guest" : count > 0 && !locked ? "gated" : "preview";

    const target: JoinTarget = { kind: "group", chat };
    const barCommunity = ofCommunity ? community : undefined;
    const name = barCommunity?.name ?? chat.name;

    const back: PreviewBack = lapsed
        ? "none"
        : ofCommunity && community?.id.communityId === input.originCommunityId
          ? "explore"
          : "back";

    // the old footers' labels: locked, then lapsed, then join
    let joinLabel: ResourceKey | undefined;
    let hint: ResourceKey | undefined;
    if (locked) {
        joinLabel = i18nKey("access.lockedGate", undefined, level, true);
        hint = i18nKey("access.lockedGateInfo", undefined, level, true);
    } else if (lapsed) {
        joinLabel = i18nKey("access.lapsed.rejoin", undefined, level, true);
        hint = i18nKey("access.lapsed.label");
    } else if (!ofCommunity && state !== "guest") {
        // the bar's own copy is a community's ("Join community", "Only public channels are shown")
        if (state === "preview") joinLabel = i18nKey("joinGroup", undefined, level, true);
        hint =
            state === "gated"
                ? i18nKey("access.previewGatedHint", { count })
                : i18nKey("access.previewHint");
    }

    return {
        target,
        name,
        community: barCommunity,
        state,
        requirements: count,
        hint,
        joinLabel,
        back,
        locked,
    };
}
