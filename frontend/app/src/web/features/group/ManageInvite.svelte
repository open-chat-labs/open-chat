<!-- Manage's Invite & share page: inviting people to a group, channel or community, adding
     community members to a private community's channel, and its invite link (InviteDialog,
     embedded), on MemberManagement as the old invite pages were, and sharing the link to a chat
     (SharePicker). People picked and not yet sent
     count as unsaved, so leaving the page asks first. The dialog says when invites went or failed; the app adds its own message when there
     is one to add (only some were added). -->
<script lang="ts">
    import {
        selectedChatMembersStore,
        selectedCommunitySummaryStore,
        type CommunitySummary,
        type MultiUserChat,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import InviteDialog, {
        type InvitePerson,
    } from "@openchat/ui/src/features/components/InviteDialog.svelte";
    import { MemberManagement, searchToInvite } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { invitePerson } from "./group.adapter";
    import { sharedLinkText } from "../share/share.adapter";
    import { SharePicker } from "../share/sharePicker.svelte";

    interface Props {
        target: MultiUserChat | CommunitySummary;
        tab: "people" | "share";
        onDirtyChange: (dirty: boolean) => void;
        onClose: () => void;
    }

    let { target, tab, onDirtyChange, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the chats the invite link can be shared to (4d): sent there at once, the dialog staying open,
    // as the picker has already shown the link and the message. A group's or channel's own link
    // isn't offered to itself; a community's goes to any chat, its open channel included.
    // svelte-ignore state_referenced_locally
    const sharePicker = new SharePicker(client, $_, () =>
        target.kind === "community" ? undefined : target.id,
    );

    async function shareToChat({
        chatId,
        message,
        link,
    }: {
        chatId: string;
        message: string;
        link: string;
    }): Promise<boolean> {
        const id = sharePicker.chatId(chatId);
        if (id === undefined) throw new Error("not a chat to share to");
        const outcome = await client.sendMessage(
            { chatId: id },
            sharedLinkText(message, link),
            false,
            undefined,
        );
        // the user backing out of the rules or the PIN is nothing sent, with nothing to say; anything
        // else not sent is a failure
        if (outcome.kind === "posted") return true;
        if (outcome.kind === "rules_declined" || outcome.kind === "pin_cancelled") return false;
        throw new Error(`invite link not sent: ${outcome.kind}`);
    }

    const community = $derived($selectedCommunitySummaryStore);

    // for the chat or community it was opened for
    const members = untrack(() => new MemberManagement(client, target));

    onMount(async () => {
        const outcome = await members.initialiseSharing();
        if (outcome.kind === "failed") toastStore.showOutcome(outcome);
    });

    const link = $derived(members.inviteLink);
    // a public chat's link is always on; a private one's can be switched off and reset
    const switchable = $derived(link?.kind === "enabled" || link?.kind === "disabled");

    // ── people ──

    const people = (users: UserSummary[]): InvitePerson[] => users.map(invitePerson);

    // both old trees searched as you typed: community members and then everyone for an invite,
    // community members for an add
    async function search(query: string, tab: "add" | "invite"): Promise<InvitePerson[]> {
        if (tab === "add") {
            const [matches] = await client.searchCommunityMembersToAdd(query, 20);
            return people(matches);
        }
        const [inCommunity, everyone] = await searchToInvite(client, target.level, query);
        return people([...inCommunity, ...everyone]);
    }

    // ── sending ──

    // the dialog keeps the picks and says it failed when these reject
    async function invite(userIds: string[]) {
        const outcome = await members.inviteUsers(userIds);
        if (outcome.kind === "failed") {
            toastStore.showOutcome(outcome);
            throw new Error("not invited");
        }
    }

    async function add(userIds: string[]) {
        const outcome = await members.addUsers(userIds);
        // a partial success has its own message; the dialog only says how many it sent
        if (outcome.kind === "failed" || outcome.message !== undefined) {
            toastStore.showOutcome(outcome);
        }
        if (outcome.kind === "failed") throw new Error("not added");
    }

    async function toggleLink(on: boolean) {
        const outcome = await members.toggleInviteLink(on);
        if (outcome.kind === "failed") {
            toastStore.showOutcome(outcome);
            throw new Error("not changed");
        }
    }

    async function resetLink(): Promise<{ link: string }> {
        const outcome = await members.confirmResetLinkResponse(true);
        const url = members.sharingLink;
        if (outcome.kind === "failed" || url === undefined) {
            toastStore.showOutcome(outcome);
            throw new Error("not reset");
        }
        return { link: url };
    }
</script>

<InviteDialog
    groupName={target.name}
    noun={target.level}
    initialTab={tab}
    embedded
    canInvite={members.canInvite()}
    canAdd={members.canAdd()}
    communityName={community?.name}
    inChannel={target.kind === "channel" ? [...$selectedChatMembersStore.keys()] : []}
    people={[]}
    onSearch={search}
    onInvite={invite}
    onAdd={add}
    shareOn={link?.kind === "enabled" || link?.kind === "public"}
    shareLink={members.sharingLink}
    onShareToggle={switchable ? toggleLink : undefined}
    onResetLink={link?.kind === "enabled" ? resetLink : undefined}
    chats={sharePicker.chats()}
    filterChats={(query) => sharePicker.search(query)}
    onShareToChat={shareToChat}
    {onDirtyChange}
    {onClose} />
