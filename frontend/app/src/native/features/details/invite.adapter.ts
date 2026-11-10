import type { InviteWay } from "@src/logic/members/invitePeople";
import type { InviteLinkLoad } from "@src/logic/members/memberManagement.svelte";

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

/**
 * The toast once they've gone: "Invite sent to Sofia", "3 invites sent", "Added Sofia" …; where
 * some didn't go (still picked), why, after it ("Added Sofia · There was an error inviting users").
 */
export function sentToast(
    added: string[],
    invited: string[],
    t: Translate,
    notSent?: string,
): string {
    const sent = sentWords(added, invited, t);
    return notSent === undefined ? sent : `${sent} · ${notSent}`;
}

function sentWords(added: string[], invited: string[], t: Translate): string {
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

/**
 * What the Invite link tab shows under its switch: a spinner while the link loads (or, switched on,
 * until its code is in), a line and Try again where it couldn't load, the line that sharing is off,
 * or the link's card, with the footnote that access gates are skipped only for a private chat's
 * link (its invite code: a public chat's is a plain link, whose joiners still pass the gates).
 */
export type LinkTabView =
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "off" }
    | { kind: "link"; url: string; gatesIgnored: boolean };

export function linkTabView(
    load: InviteLinkLoad,
    on: boolean,
    url: string | undefined,
): LinkTabView {
    if (load.kind === "failed") return { kind: "failed" };
    if (load.kind !== "loaded") return { kind: "loading" };
    if (!on) return { kind: "off" };
    if (url === undefined) return { kind: "loading" };
    return { kind: "link", url, gatesIgnored: load.link.kind === "enabled" };
}

/** A chip's name: the first word of their name ("Sofia" for "Sofia Marín"), else their username. */
export function chipName(name: string, username: string): string {
    return name.trim().split(/\s+/)[0] || username;
}
