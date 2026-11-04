import {
    i18nKey,
    isCompositeGate,
    isLocked,
    isUniquePersonGate,
    ROLE_NONE,
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
    name: string;
    state: PreviewBarState;
    /** gated: how many requirements joining has. */
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
    /** The gates joining the chat has (`client.accessGatesForChat`): its community's, then its own. */
    gates: EnhancedAccessGate[];
    guest: boolean;
    /** The community whose preview was opened from Explore (`setCommunityPreviewOrigin`). */
    originCommunityId: string | undefined;
    /** Whether the user meets a gate from what the client knows (`client.doesUserMeetAccessGate`). */
    meets: (gate: AccessGate) => boolean;
};

/** Whether a community is being previewed: not joined, or lapsed. */
export function previewingCommunity(community: CommunitySummary | undefined): boolean {
    return (
        community !== undefined &&
        (community.membership.role === ROLE_NONE || community.membership.lapsed)
    );
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
 * How many requirements some gates have: each gate's leaves, less the suspended unique-person gate
 * (which joining never asks for).
 */
export function requirementCount(gates: AccessGate[]): number {
    return gates
        .map(stripSuspendedGate)
        .reduce(
            (n, g) =>
                n +
                (isCompositeGate(g)
                    ? g.gates.filter((l) => !isUniquePersonGate(l)).length
                    : g.kind === "no_gate"
                      ? 0
                      : 1),
            0,
        );
}

/**
 * The bar for a preview. A channel of a community being previewed (or lapsed) is the community's
 * preview: joining it joins the community (its gates, a level at a time, then the channel's own on
 * the channel's bar if it has any), and Back cancels the community's preview. Otherwise it's the
 * group's or channel's.
 */
export function previewBar(input: PreviewBarInput): PreviewBar {
    const { chat, community, guest, meets } = input;
    const ofCommunity = chat.kind === "channel" && previewingCommunity(community);
    const level = ofCommunity ? "community" : chat.level;
    const lapsed = ofCommunity ? community?.membership.lapsed === true : input.lapsed;
    const gates = ofCommunity ? input.gates.filter((g) => g.level === "community") : input.gates;
    const locked = gates.some((g) => isLocked(g));
    const count = requirementCount(gates.filter((g) => !meets(g)));
    const state: PreviewBarState = guest ? "guest" : count > 0 && !locked ? "gated" : "preview";

    const target: JoinTarget =
        ofCommunity && community !== undefined
            ? { kind: "community", community }
            : { kind: "group", chat };
    const name = target.kind === "community" ? target.community.name : chat.name;

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

    return { target, name, state, requirements: count, hint, joinLabel, back, locked };
}
