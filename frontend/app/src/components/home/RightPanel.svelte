<script lang="ts">
    import Panel from "../Panel.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import InviteUsers from "./groupdetails/InviteUsers.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import { popRightPanelHistory, rightPanelHistory } from "../../stores/rightPanel";
    import type {
        ChatEvent,
        EventWrapper,
        GroupChatSummary,
        AccessRules,
        MemberRole,
        Message,
        UserSummary,
        OpenChat,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Readable } from "svelte/store";
    import { _ } from "svelte-i18n";
    import { numberOfColumns } from "stores/layout";
    import Thread from "./thread/Thread.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam, removeThreadMessageIndex } from "../../utils/urls";
    import { logger } from "../../utils/logging";
    import { pathParams } from "../../routes";
    import page from "page";
    import { compareRoles } from "openchat-shared";
    import CommunityDetails from "./communities/details/CommunitySummary.svelte";
    import CommunityChannels from "./communities/details/CommunityChannels.svelte";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");
    const currentUser = client.user;

    let invitingUsers = false;

    $: selectedChatId = client.selectedChatId;
    $: selectedChatStore = client.selectedChatStore;
    $: chatStateStore = client.chatStateStore;
    $: currentChatMembers = client.currentChatMembers;
    $: currentChatInvited = client.currentChatInvitedUsers;
    $: currentChatBlocked = client.currentChatBlockedUsers;
    $: currentChatRules = client.currentChatRules;
    $: currentChatPinnedMessages = client.currentChatPinnedMessages;

    $: currentCommunityMembers = client.currentCommunityMembers;
    $: currentCommunityInvited = client.currentCommunityInvitedUsers;
    $: currentCommunityBlocked = client.currentCommunityBlockedUsers;
    $: currentCommunityRules = client.currentCommunityRules;
    $: selectedCommunity = client.selectedCommunity;
    $: communityStateStore = client.communityStateStore;

    $: eventsStore = client.eventsStore;
    $: userStore = client.userStore;
    $: user = $userStore[currentUser.userId] ?? client.nullUser("unknown");
    $: lastState = $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = $numberOfColumns === 2;
    $: groupChat = selectedChatStore as Readable<GroupChatSummary>;
    $: empty = $rightPanelHistory.length === 0;

    function onChangeGroupRole(
        ev: CustomEvent<{ userId: string; newRole: MemberRole; oldRole: MemberRole }>
    ): void {
        if ($selectedChatId !== undefined) {
            let { userId, newRole, oldRole } = ev.detail;
            changeGroupRole($selectedChatId, userId, newRole, oldRole);
        }
    }

    function onChangeCommunityRole(
        ev: CustomEvent<{ userId: string; newRole: MemberRole; oldRole: MemberRole }>
    ): void {
        if ($selectedCommunity !== undefined) {
            const { userId, newRole, oldRole } = ev.detail;
            changeCommunityRole($selectedCommunity.id, userId, newRole, oldRole);
        }
    }

    function onRemoveGroupMember(ev: CustomEvent<string>): void {
        if ($selectedChatId !== undefined) {
            chatStateStore.updateProp($selectedChatId, "members", (ps) =>
                ps.filter((p) => p.userId !== ev.detail)
            );
            removeGroupMember($selectedChatId, ev.detail);
        }
    }

    function onRemoveCommunityMember(ev: CustomEvent<string>): void {
        toastStore.showSuccessToast("TODO - remove community member");
    }

    async function inviteGroupUsers(ev: CustomEvent<UserSummary[]>) {
        if ($selectedChatId !== undefined) {
            const userIds = ev.detail.map((u) => u.userId);

            invitingUsers = true;

            await client
                .inviteUsers($selectedChatId, userIds)
                .then((resp) => {
                    switch (resp) {
                        case "success":
                            popRightPanelHistory();
                            if ($groupChat?.public ?? false) {
                                toastStore.showSuccessToast("group.usersInvited");
                            }
                            break;
                        case "too_many_invites":
                            toastStore.showFailureToast("group.tooManyInvites");
                            break;
                        default:
                            toastStore.showFailureToast("group.inviteUsersFailed");
                            break;
                    }
                })
                .catch((err) => {
                    logger.error("InviteUsersFailed", err);
                    toastStore.showFailureToast("group.inviteUsersFailed");
                });

            invitingUsers = false;
        }
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>): void {
        dispatch("goToMessageIndex", ev.detail);
        if (modal) {
            popRightPanelHistory();
        }
    }

    function stripThreadFromUrl(path: string) {
        if (
            $pathParams.kind === "global_chat_selected_route" &&
            $pathParams.threadMessageIndex !== undefined
        ) {
            return removeThreadMessageIndex($pathParams.threadMessageIndex, path);
        }
        return path;
    }

    function closeThread(_ev: CustomEvent<string>) {
        popRightPanelHistory();
        page.replace(stripThreadFromUrl(removeQueryStringParam("open")));
    }

    function findMessage(
        events: EventWrapper<ChatEvent>[],
        messageId: bigint
    ): EventWrapper<Message> | undefined {
        return events.find((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId;
        }) as EventWrapper<Message> | undefined;
    }

    function changeGroupRole(
        chatId: string,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole
    ): Promise<void> {
        // Call backend to changeRole
        return client.changeRole(chatId, userId, newRole, oldRole).then((success) => {
            if (!success) {
                const roleText = $_(newRole);
                const promotion = compareRoles(newRole, oldRole) > 0;
                const message = $_(promotion ? "promoteFailed" : "demoteFailed", {
                    values: { role: roleText },
                });
                toastStore.showFailureToast(message);
            }
        });
    }

    function changeCommunityRole(
        _id: string,
        _userId: string,
        _newRole: MemberRole,
        _oldRole: MemberRole
    ) {
        toastStore.showSuccessToast("TODO - change community role");
    }

    function removeGroupMember(chatId: string, userId: string): Promise<void> {
        return client
            .removeMember(chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast("removeMemberFailed");
                }
            })
            .catch((err) => {
                logger.error("Unable to remove member", err);
                toastStore.showFailureToast("removeMemberFailed");
            });
    }

    async function onBlockGroupUser(ev: CustomEvent<{ userId: string }>) {
        if ($selectedChatId !== undefined) {
            const success = await client.blockUser($selectedChatId, ev.detail.userId);
            if (success) {
                toastStore.showSuccessToast("blockUserSucceeded");
            } else {
                toastStore.showFailureToast("blockUserFailed");
            }
        }
    }

    async function onBlockCommunityUser(ev: CustomEvent<{ userId: string }>) {
        toastStore.showSuccessToast("TODO - block community user");
    }

    async function onUnblockGroupUser(ev: CustomEvent<UserSummary>) {
        if ($selectedChatId !== undefined) {
            const success = await client.unblockUser($selectedChatId, ev.detail.userId);
            if (success) {
                toastStore.showSuccessToast("unblockUserSucceeded");
            } else {
                toastStore.showFailureToast("unblockUserFailed");
            }
        }
    }

    async function onUnblockCommnityUser(ev: CustomEvent<UserSummary>) {
        toastStore.showSuccessToast("TODO - unblock community user");
    }

    function showInviteGroupUsers(ev: CustomEvent<boolean>) {
        dispatch("showInviteGroupUsers", ev.detail);
    }

    function showInviteCommunityUsers(ev: CustomEvent<boolean>) {
        dispatch("showInviteGroupUsers", ev.detail);
    }

    function updateGroupRules(ev: CustomEvent<{ chatId: string; rules: AccessRules }>) {
        chatStateStore.setProp(ev.detail.chatId, "rules", ev.detail.rules);
    }

    $: threadRootEvent =
        lastState.kind === "message_thread_panel" && $selectedChatId !== undefined
            ? findMessage($eventsStore, lastState.threadRootMessageId)
            : undefined;

    $: console.log("LastState: ", lastState);
</script>

<Panel right {empty}>
    {#if lastState.kind === "group_details" && $selectedChatId !== undefined}
        <GroupDetails
            chat={$groupChat}
            memberCount={$currentChatMembers.length}
            rules={$currentChatRules}
            on:close={popRightPanelHistory}
            on:updateGroupRules={updateGroupRules}
            on:deleteGroup
            on:editGroup
            on:chatWith
            on:showGroupMembers />
    {:else if lastState.kind === "invite_community_users"}
        <InviteUsers
            busy={invitingUsers}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            on:inviteUsers={inviteGroupUsers}
            on:cancelInviteUsers={popRightPanelHistory} />
    {:else if lastState.kind === "show_community_members" && $selectedCommunity}
        <Members
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            collection={$selectedCommunity}
            invited={$currentCommunityInvited}
            members={$currentCommunityMembers}
            blocked={$currentCommunityBlocked}
            on:close={popRightPanelHistory}
            on:blockUser={onBlockCommunityUser}
            on:unblockUser={onUnblockCommnityUser}
            on:chatWith
            on:showInviteUsers={showInviteCommunityUsers}
            on:removeMember={onRemoveCommunityMember}
            on:changeRole={onChangeCommunityRole} />
    {:else if lastState.kind === "invite_group_users"}
        <InviteUsers
            busy={invitingUsers}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            on:inviteUsers={inviteGroupUsers}
            on:cancelInviteUsers={popRightPanelHistory} />
    {:else if lastState.kind === "show_group_members" && $selectedChatId !== undefined}
        <Members
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            collection={$groupChat}
            invited={$currentChatInvited}
            members={$currentChatMembers}
            blocked={$currentChatBlocked}
            on:close={popRightPanelHistory}
            on:blockUser={onBlockGroupUser}
            on:unblockUser={onUnblockGroupUser}
            on:chatWith
            on:showInviteUsers={showInviteGroupUsers}
            on:removeMember={onRemoveGroupMember}
            on:changeRole={onChangeGroupRole} />
    {:else if lastState.kind === "show_pinned" && $selectedChatId !== undefined}
        <PinnedMessages
            on:chatWith
            on:goToMessageIndex={goToMessageIndex}
            chatId={$selectedChatId}
            pinned={$currentChatPinnedMessages}
            dateLastPinned={$groupChat.dateLastPinned}
            on:close={popRightPanelHistory} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => client.setSoftDisabled(true)}
            on:upgrade
            {user}
            on:userAvatarSelected
            on:closeProfile={popRightPanelHistory} />
    {:else if threadRootEvent !== undefined && $selectedChatStore !== undefined}
        <Thread
            on:chatWith
            on:upgrade
            on:replyPrivatelyTo
            rootEvent={threadRootEvent}
            chat={$selectedChatStore}
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChatId !== undefined}
        <ProposalGroupFilters on:close={popRightPanelHistory} />
    {:else if lastState.kind === "community_channels"}
        <CommunityChannels />
    {:else if lastState.kind === "community_details"}
        <CommunityDetails on:deleteCommunity on:editCommunity />
    {/if}
</Panel>
