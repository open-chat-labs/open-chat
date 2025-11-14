<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { Body, CommonButton, Container, ListAction } from "component-lib";
    import {
        allUsersStore,
        compareRoles,
        OpenChat,
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_OWNER,
        roleAsText,
        selectedChatMembersStore,
        type FullMember,
        type MemberRole,
        type Member as MemberType,
        type MultiUserChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import Member from "./Member.svelte";

    const TO_SHOW = 5;
    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
    }

    let { chat }: Props = $props();

    let memberCount = $derived($selectedChatMembersStore.size);
    let more = $derived(memberCount - TO_SHOW);
    let subset = $derived<FullMember[]>(
        getKnownUsers([...$selectedChatMembersStore.values()].slice(0, TO_SHOW)),
    );

    // we will get a feel for the duplication and then extract some of this gubbings into a .svelte.ts file
    function getKnownUsers(members: MemberType[]): FullMember[] {
        const users: FullMember[] = [];
        members.forEach((m) => {
            const user = $allUsersStore.get(m.userId);
            if (user) {
                users.push({
                    ...user,
                    ...m,
                    displayName: m.displayName ?? user.displayName,
                });
            }
        });
        return users;
    }

    function showAllMembers() {}

    function inviteUsers() {}

    function share() {}

    async function onBlockUser(userId: string) {
        const success = await client.blockUser(chat.id, userId);
        if (success) {
            toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("blockUserFailed"));
        }
    }

    function onChangeRole(args: {
        userId: string;
        newRole: MemberRole;
        oldRole: MemberRole;
    }): void {
        let { userId, newRole, oldRole } = args;
        client.changeRole(chat.id, userId, newRole, oldRole).then((success) => {
            if (!success) {
                const roleText = $_(roleAsText(newRole));
                const promotion = compareRoles(newRole, oldRole) > 0;
                const message = i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
                    role: roleText,
                });
                toastStore.showFailureToast(message);
            }
        });
    }

    function onRemoveMember(userId: string): void {
        client
            .removeMember(chat.id, userId)
            .then((resp) => {
                if (resp.kind !== "success") {
                    toastStore.showFailureToast(i18nKey("removeMemberFailed"));
                }
            })
            .catch((err) => {
                client.logError("Unable to remove member", err);
                toastStore.showFailureToast(i18nKey("removeMemberFailed"));
            });
    }
</script>

<Container gap={"xl"} direction={"vertical"}>
    <Container>
        <Body colour={"textSecondary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Members")}></Translatable>
        </Body>

        {#if memberCount > TO_SHOW}
            <CommonButton onClick={showAllMembers} size={"small_text"} mode={"active"}>
                <Translatable resourceKey={i18nKey(`View all (+${more})`)}></Translatable>
            </CommonButton>
        {/if}
    </Container>

    <ListAction onClick={inviteUsers}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Add members
    </ListAction>

    <ListAction colour={"secondary"} onClick={share}>
        {#snippet icon(color)}
            <AccountPlus {color} />
        {/snippet}
        Invite via link or QR code
    </ListAction>

    {#each subset as member}
        {#if member !== undefined}
            <Member
                me={false}
                {member}
                canPromoteToOwner={client.canPromote(chat.id, member.role, ROLE_OWNER)}
                canPromoteToAdmin={client.canPromote(chat.id, member.role, ROLE_ADMIN)}
                canDemoteToAdmin={client.canDemote(chat.id, member.role, ROLE_ADMIN)}
                canPromoteToModerator={client.canPromote(chat.id, member.role, ROLE_MODERATOR)}
                canDemoteToModerator={client.canDemote(chat.id, member.role, ROLE_MODERATOR)}
                canDemoteToMember={client.canDemote(chat.id, member.role, ROLE_MEMBER)}
                canBlockUser={client.canBlockUsers(chat.id)}
                canRemoveMember={client.canRemoveMembers(chat.id)}
                {onBlockUser}
                {onChangeRole}
                {onRemoveMember} />
        {/if}
    {/each}
</Container>
