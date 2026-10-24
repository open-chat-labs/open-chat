<!-- Inviting people to a group, channel or community, adding community members to a private
     community's channel, and its invite link (InviteDialog), on MemberManagement as the old invite
     pages were. The dialog says when invites went or failed; the app adds its own message when there
     is one to add (only some were added). -->
<script lang="ts">
    import {
        selectedChatMembersStore,
        selectedChatSummaryStore,
        selectedCommunitySummaryStore,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import InviteDialog, {
        type InvitePerson,
    } from "@openchat/ui/src/features/components/InviteDialog.svelte";
    import { MemberManagement, searchToInvite } from "@src/logic/members/memberManagement.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext, onMount, untrack } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { dialogTarget } from "./dialogTarget";
    import { invitePerson } from "./group.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "invite" }>> = $props();

    const client = getContext<OpenChat>("client");

    const target = $derived(
        dialogTarget(dialog.target, $selectedChatSummaryStore, $selectedCommunitySummaryStore),
    );
    const community = $derived($selectedCommunitySummaryStore);

    // for the chat or community it was opened for
    const members = untrack(() =>
        target === undefined ? undefined : new MemberManagement(client, target),
    );

    onMount(async () => {
        if (members === undefined) return;
        const outcome = await members.initialiseSharing();
        if (outcome.kind === "failed") toastStore.showOutcome(outcome);
    });

    const link = $derived(members?.inviteLink);
    // a public chat's link is always on; a private one's can be switched off and reset
    const switchable = $derived(link?.kind === "enabled" || link?.kind === "disabled");

    // ── people ──

    const people = (users: UserSummary[]): InvitePerson[] => users.map(invitePerson);

    // both old trees searched as you typed: community members and then everyone for an invite,
    // community members for an add
    async function search(query: string, tab: "add" | "invite"): Promise<InvitePerson[]> {
        if (target === undefined) return [];
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
        if (members === undefined) return;
        const outcome = await members.inviteUsers(userIds);
        if (outcome.kind === "failed") {
            toastStore.showOutcome(outcome);
            throw new Error("not invited");
        }
    }

    async function add(userIds: string[]) {
        if (members === undefined) return;
        const outcome = await members.addUsers(userIds);
        // a partial success has its own message; the dialog only says how many it sent
        if (outcome.kind === "failed" || outcome.message !== undefined) {
            toastStore.showOutcome(outcome);
        }
        if (outcome.kind === "failed") throw new Error("not added");
    }

    async function toggleLink(on: boolean) {
        if (members === undefined) return;
        const outcome = await members.toggleInviteLink(on);
        if (outcome.kind === "failed") {
            toastStore.showOutcome(outcome);
            throw new Error("not changed");
        }
    }

    async function resetLink(): Promise<{ link: string }> {
        if (members === undefined) throw new Error("no link");
        const outcome = await members.confirmResetLinkResponse(true);
        const url = members.sharingLink;
        if (outcome.kind === "failed" || url === undefined) {
            toastStore.showOutcome(outcome);
            throw new Error("not reset");
        }
        return { link: url };
    }
</script>

{#if target !== undefined && members !== undefined}
    <InviteDialog
        groupName={target.name}
        noun={target.level}
        initialTab={dialog.tab}
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
        onCancel={onClose} />
{/if}
