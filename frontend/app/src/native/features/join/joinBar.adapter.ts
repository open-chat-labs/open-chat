import { i18nKey, type MultiUserChat, type ResourceKey } from "@client";
import { joinFailure, type JoinStep } from "@src/logic/join/joinFlow.svelte";
import type { PreviewBar } from "@src/logic/join/previewBar";

// The join bar in place of the composer (N8b, native plan 04 "Joining" and 12 "Preview and join"):
// a line saying what's previewed over Join. What Join joins is logic/join's `previewBar`; this is
// what the bar says. A channel of a community being previewed names the community ("Join
// community"), since Join joins the community with the channel.

export type JoinBarView = {
    note: ResourceKey;
    label: ResourceKey;
    icon: "plus" | "lock";
    /** Join can't be pressed. */
    disabled: boolean;
};

export function joinBarView(bar: PreviewBar, chat: MultiUserChat): JoinBarView {
    const gated = bar.state === "gated";
    // a locked gate and a lapse have the old footers' words, which previewBar picks
    const oldWords = bar.locked || bar.lapsed;
    const level = bar.community !== undefined ? "community" : chat.level;
    return {
        note: (oldWords ? bar.hint : undefined) ?? previewNote(bar, chat),
        label:
            (oldWords ? bar.joinLabel : undefined) ??
            (bar.state === "guest"
                ? i18nKey("native.join.signIn")
                : gated
                  ? i18nKey("native.join.review")
                  : i18nKey("joinGroup", undefined, level, true)),
        icon: bar.locked || gated ? "lock" : "plus",
        // "Review and join" asks the client, which answers with the requirements (JoinSheet)
        disabled: bar.locked,
    };
}

function previewNote(bar: PreviewBar, chat: MultiUserChat): ResourceKey {
    if (bar.community !== undefined) {
        return i18nKey("native.join.previewingChannel", {
            channel: chat.name,
            community: bar.community.name,
        });
    }
    return chat.kind === "channel"
        ? i18nKey("native.join.notInChannel", { channel: chat.name })
        : i18nKey("native.join.previewingGroup", { group: chat.name });
}

/**
 * What a join from the bar says once it settles: "You joined …" (`name`: what the bar named), or
 * why it didn't go through. A guest's join opens sign-in by itself and a dismissed PIN prompt says
 * nothing.
 */
export function joinStepToast(step: JoinStep, name: string): ResourceKey | undefined {
    switch (step.kind) {
        case "joined":
            return i18nKey("access.joined", { name });
        case "failed":
        case "gate_check_failed":
            return joinFailure(step);
        // the requirements sheet shows them
        case "evaluate_gates":
        case "not_sent":
        case "cancelled":
            return undefined;
        default:
            return step satisfies never;
    }
}
