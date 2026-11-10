import type { InviteWay } from "@src/logic/members/invitePeople";

// The Invite people screen's words (native plan 10): the pinned button's label for what's picked,
// the toast once they've gone, and a picked person's chip. Translated by the screen's `t`.

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Someone picked: how they'd join, and their name. */
export type Picked = { way: InviteWay; name: string };

/**
 * The pinned button: "Send invites" with no one picked (disabled), "Send invite", "Send 3 invites";
 * "Add 2 people" where everyone picked is a community member to add to the channel.
 */
export function sendLabel(picked: Picked[], t: Translate): string {
    const count = picked.length;
    if (count > 0 && picked.every((p) => p.way === "add")) {
        return t("native.invite.add", { count });
    }
    return t("native.invite.send", { count });
}

/** The toast once they've gone: "Invite sent to Sofia", "3 invites sent", "Added Sofia" … */
export function sentToast(added: string[], invited: string[], t: Translate): string {
    if (added.length > 0 && invited.length > 0) {
        return t("native.invite.sentBoth", { added: added.length, invited: invited.length });
    }
    if (added.length > 0) {
        return added.length === 1
            ? t("native.invite.addedOne", { name: added[0] })
            : t("native.invite.added", { count: added.length });
    }
    return invited.length === 1
        ? t("native.invite.sentOne", { name: invited[0] })
        : t("native.invite.sent", { count: invited.length });
}

/** A chip's name: the first word of their name ("Sofia" for "Sofia Marín"), else their username. */
export function chipName(name: string, username: string): string {
    return name.trim().split(/\s+/)[0] || username;
}
