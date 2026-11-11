import type { CommunitySummary, MessageFormatter, MultiUserChat, OpenChat } from "@client";
import { i18nKey, interpolate } from "@src/i18n/i18n";
import { chatInviteAccess, inviteRole } from "@src/logic/members/invitePeople";
import type { ScreenContext } from "../app/screens";

/**
 * Invite (a group's details' tile, the Members screen's Invite people row): pushes Invite people
 * for someone who may invite, add or share a public group's link; otherwise says who can ("Only
 * admins can invite to this group", the lowest role the permission allows).
 */
export function openInvite(
    client: OpenChat,
    chat: MultiUserChat,
    community: CommunitySummary | undefined,
    anon: boolean,
    context: Pick<ScreenContext, "push" | "toast">,
    formatter: MessageFormatter,
): void {
    if (chatInviteAccess(client, chat, community, anon).kind === "allowed") {
        context.push({ kind: "invite_people", chatId: chat.id });
        return;
    }
    const role = inviteRole(chat.permissions.inviteUsers);
    context.toast(
        interpolate(
            formatter,
            i18nKey(`native.invite.notAllowed.${role}`, undefined, chat.level, true),
        ),
    );
}
