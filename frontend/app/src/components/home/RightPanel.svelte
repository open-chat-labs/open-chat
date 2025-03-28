<script lang="ts">
    import UserProfile from "./profile/UserProfile.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import InviteUsers from "./groupdetails/InviteUsers.svelte";
    import CommunityFilters from "./communities/explore/Filters.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import { popRightPanelHistory, rightPanelHistory } from "../../stores/rightPanel";
    import type {
        ChatEvent,
        CommunityIdentifier,
        EventWrapper,
        MemberRole,
        Message,
        UserSummary,
        OpenChat,
        MultiUserChat,
        MultiUserChatIdentifier,
        Level,
    } from "openchat-client";
    import { toastStore } from "../../stores/toast";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Readable } from "svelte/store";
    import { _ } from "svelte-i18n";
    import { fullWidth } from "../../stores/layout";
    import Thread from "./thread/Thread.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import { removeQueryStringParam, removeThreadMessageIndex } from "../../utils/urls";
    import { pageReplace, pathParams } from "../../routes";
    import { compareRoles } from "openchat-client";
    import CommunityDetails from "./communities/details/CommunitySummary.svelte";
    import { currentTheme } from "../../theme/themes";
    import Resizable from "../Resizable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { activeVideoCall } from "../../stores/video";
    import ActiveCallParticipants from "./video/ActiveCallParticipants.svelte";
    import ChannelOrCommunityMembers from "./ChannelOrCommunityMembers.svelte";
    import ChannelOrCommunitySummary from "./ChannelOrCommunitySummary.svelte";
    import ChannelOrCommunityInvite from "./ChannelOrCommunityInvite.svelte";
    import {
        userStore,
        currentUser,
        selectedChatId,
        selectedChatStore as selectedChat,
        currentChatMembers,
        currentChatInvitedUsers as currentChatInvited,
        currentChatBlockedUsers as currentChatBlocked,
        currentChatLapsedMembers,
        currentChatPinnedMessages,
        currentCommunityMembers,
        currentCommunityInvitedUsers as currentCommunityInvited,
        currentCommunityBlockedUsers as currentCommunityBlocked,
        currentCommunityLapsedMembers as currentCommunityLapsed,
        selectedCommunity,
        eventsStore,
        currentCommunityBots,
        currentChatBots,
        currentCommunityApiKeys,
        currentChatApiKeys,
    } from "openchat-client";
    import { publish } from "@src/utils/pubsub";

    const dispatch = createEventDispatcher();

    const client = getContext<OpenChat>("client");

    let invitingUsers = false;
    let section: HTMLElement;
    let resized = false;
    let resizing = false;
    let resizedWidth = "7";

    $: user = $userStore.get($currentUser.userId) ?? client.nullUser("unknown");
    $: lastState = $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" };
    $: modal = !$fullWidth;
    $: multiUserChat = selectedChat as Readable<MultiUserChat>;
    $: empty = $rightPanelHistory.length === 0;

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunity !== undefined && client.canInviteUsers($selectedCommunity.id);
        return client.searchUsersForInvite(term, 20, level, false, canInvite);
    }

    function searchMembers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchCommunityMembersToAdd(term, 20);
    }

    function onChangeGroupRole(
        ev: CustomEvent<{ userId: string; newRole: MemberRole; oldRole: MemberRole }>,
    ): void {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            let { userId, newRole, oldRole } = ev.detail;
            changeGroupRole($selectedChatId, userId, newRole, oldRole);
        }
    }

    function onChangeCommunityRole(
        ev: CustomEvent<{ userId: string; newRole: MemberRole; oldRole: MemberRole }>,
    ): void {
        if ($selectedCommunity !== undefined) {
            const { userId, newRole, oldRole } = ev.detail;
            changeCommunityRole($selectedCommunity.id, userId, newRole, oldRole);
        }
    }

    function onRemoveGroupMember(ev: CustomEvent<string>): void {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            removeGroupMember($selectedChatId, ev.detail);
        }
    }

    function onRemoveCommunityMember(ev: CustomEvent<string>): void {
        if ($selectedCommunity !== undefined) {
            removeCommunityMember($selectedCommunity.id, ev.detail);
        }
    }

    async function inviteCommunityUsers(ev: CustomEvent<UserSummary[]>) {
        if ($selectedCommunity !== undefined) {
            const userIds = ev.detail.map((u) => u.userId);

            invitingUsers = true;

            await client.inviteUsers($selectedCommunity.id, userIds).then((resp) => {
                if (resp) {
                    popRightPanelHistory();
                    if ($multiUserChat?.public ?? false) {
                        toastStore.showSuccessToast(i18nKey("communities.usersInvited"));
                    }
                } else {
                    toastStore.showFailureToast(i18nKey("communities.errors.inviteUsers"));
                }
            });

            invitingUsers = false;
        }
    }

    async function inviteGroupUsers(ev: CustomEvent<UserSummary[]>) {
        if (
            $multiUserChat !== undefined &&
            ($multiUserChat.id.kind === "group_chat" || $multiUserChat.id.kind === "channel")
        ) {
            const userIds = ev.detail.map((u) => u.userId);

            invitingUsers = true;

            await client
                .inviteUsers($multiUserChat.id, userIds)
                .then((resp) => {
                    if (resp) {
                        popRightPanelHistory();
                        if ($multiUserChat?.public ?? false) {
                            toastStore.showSuccessToast(i18nKey("group.usersInvited"));
                        }
                    } else {
                        toastStore.showFailureToast(
                            i18nKey(
                                "group.inviteUsersFailed",
                                undefined,
                                $multiUserChat.level,
                                true,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    client.logError("InviteUsersFailed", err);
                    toastStore.showFailureToast(
                        i18nKey("group.inviteUsersFailed", undefined, $multiUserChat.level, true),
                    );
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
            ($pathParams.kind === "global_chat_selected_route" ||
                $pathParams.kind === "selected_channel_route") &&
            $pathParams.threadMessageIndex !== undefined
        ) {
            return removeThreadMessageIndex($pathParams.threadMessageIndex, path);
        }
        return path;
    }

    function closeThread(_ev: CustomEvent<string>) {
        popRightPanelHistory();
        pageReplace(stripThreadFromUrl(removeQueryStringParam("open")));
        activeVideoCall.threadOpen(false);
    }

    function findMessage(
        events: EventWrapper<ChatEvent>[],
        messageId: bigint,
    ): EventWrapper<Message> | undefined {
        return events.find((e) => {
            return e.event.kind === "message" && e.event.messageId === messageId;
        }) as EventWrapper<Message> | undefined;
    }

    function changeGroupRole(
        chatId: MultiUserChatIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole,
    ): Promise<void> {
        // Call backend to changeRole
        return client.changeRole(chatId, userId, newRole, oldRole).then((success) => {
            if (!success) {
                const roleText = $_(newRole);
                const promotion = compareRoles(newRole, oldRole) > 0;
                const message = i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
                    role: roleText,
                });
                toastStore.showFailureToast(message);
            }
        });
    }

    function changeCommunityRole(
        id: CommunityIdentifier,
        userId: string,
        newRole: MemberRole,
        oldRole: MemberRole,
    ) {
        return client.changeCommunityRole(id, userId, newRole, oldRole).then((success) => {
            if (!success) {
                const roleText = $_(newRole);
                const promotion = compareRoles(newRole, oldRole) > 0;
                const message = i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
                    role: roleText,
                });
                toastStore.showFailureToast(message);
            }
        });
    }

    function removeCommunityMember(id: CommunityIdentifier, userId: string): Promise<void> {
        return client
            .removeCommunityMember(id, userId)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast(i18nKey("removeMemberFailed"));
                }
            })
            .catch((err) => {
                client.logError("Unable to remove member", err);
                toastStore.showFailureToast(i18nKey("removeMemberFailed"));
            });
    }

    function removeGroupMember(chatId: MultiUserChatIdentifier, userId: string): Promise<void> {
        return client
            .removeMember(chatId, userId)
            .then((resp) => {
                if (resp !== "success") {
                    toastStore.showFailureToast(i18nKey("removeMemberFailed"));
                }
            })
            .catch((err) => {
                client.logError("Unable to remove member", err);
                toastStore.showFailureToast(i18nKey("removeMemberFailed"));
            });
    }

    async function onBlockGroupUser(ev: CustomEvent<{ userId: string }>) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            const success = await client.blockUser($selectedChatId, ev.detail.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onBlockCommunityUser(ev: CustomEvent<{ userId: string }>) {
        if ($selectedCommunity !== undefined) {
            const success = await client.blockCommunityUser(
                $selectedCommunity.id,
                ev.detail.userId,
            );
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onUnblockGroupUser(ev: CustomEvent<UserSummary>) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            const success = await client.unblockUser($selectedChatId, ev.detail.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    async function onUnblockCommnityUser(ev: CustomEvent<UserSummary>) {
        if ($selectedCommunity !== undefined) {
            const success = await client.unblockCommunityUser(
                $selectedCommunity.id,
                ev.detail.userId,
            );
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    function showInviteGroupUsers(ev: CustomEvent<boolean>) {
        publish("showInviteGroupUsers", ev.detail);
    }

    function showInviteCommunityUsers() {
        if ($selectedCommunity !== undefined) {
            rightPanelHistory.set([{ kind: "invite_community_users" }]);
        }
    }

    function onCancelCommunityInvite(ev: CustomEvent<string>) {
        if ($selectedCommunity !== undefined) {
            cancelInvite($selectedCommunity.id, ev.detail);
        }
    }

    async function onCancelGroupInvite(ev: CustomEvent<string>) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            cancelInvite($selectedChatId, ev.detail);
        }
    }

    async function cancelInvite(id: MultiUserChatIdentifier | CommunityIdentifier, userId: string) {
        const success = await client.cancelInvites(id, [userId]);
        if (success) {
            toastStore.showSuccessToast(i18nKey("cancelInviteSucceeded"));
        } else {
            toastStore.showFailureToast(i18nKey("cancelInviteFailed"));
        }
    }

    $: threadRootEvent =
        lastState.kind === "message_thread_panel" && $selectedChatId !== undefined
            ? findMessage($eventsStore, lastState.threadRootMessageId)
            : undefined;

    $: level = (
        lastState.kind === "invite_community_users"
            ? "community"
            : $selectedChat?.kind === "channel"
              ? "channel"
              : "group"
    ) as Level;
</script>

<section
    bind:this={section}
    class:modal
    class:resized
    class:resizing
    style={`--resized-width: ${resizedWidth}`}
    class:halloween={$currentTheme.name === "halloween"}
    class:empty>
    {#if lastState.kind === "group_details" && $selectedChatId !== undefined && $multiUserChat !== undefined}
        {#if $multiUserChat.kind === "channel" && $selectedCommunity !== undefined}
            <ChannelOrCommunitySummary
                channel={$multiUserChat}
                memberCount={$currentChatMembers.length}
                community={$selectedCommunity}
                selectedTab="channel"
                on:editGroup
                on:editCommunity
                on:close={popRightPanelHistory} />
        {:else}
            <GroupDetails
                chat={$multiUserChat}
                memberCount={$currentChatMembers.length}
                on:close={popRightPanelHistory}
                on:editGroup />
        {/if}
    {:else if lastState.kind === "call_participants_panel"}
        <ActiveCallParticipants
            isOwner={lastState.isOwner}
            chatId={lastState.chatId}
            messageId={lastState.messageId} />
    {:else if lastState.kind === "invite_community_users" && $selectedCommunity !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel" && $selectedCommunity !== undefined}
            <ChannelOrCommunityInvite
                channel={$multiUserChat}
                community={$selectedCommunity}
                userLookup={searchUsers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                selectedTab="community"
                on:inviteCommunityUsers={inviteCommunityUsers}
                on:inviteChannelUsers={inviteGroupUsers}
                on:cancelInviteUsers={popRightPanelHistory} />
        {:else}
            <InviteUsers
                {level}
                container={$selectedCommunity}
                userLookup={searchUsers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                isCommunityPublic={$selectedCommunity?.public ?? true}
                on:inviteUsers={inviteCommunityUsers}
                on:cancelInviteUsers={popRightPanelHistory} />
        {/if}
    {:else if lastState.kind === "show_community_members" && $selectedCommunity !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunityMembers
                channel={$multiUserChat}
                community={$selectedCommunity}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                selectedTab="community"
                on:showInviteCommunityUsers={showInviteCommunityUsers}
                on:removeCommunityMember={onRemoveCommunityMember}
                on:changeCommunityRole={onChangeCommunityRole}
                on:blockCommunityUser={onBlockCommunityUser}
                on:unblockCommunityUser={onUnblockCommnityUser}
                on:blockGroupUser={onBlockGroupUser}
                on:unblockGroupUser={onUnblockGroupUser}
                on:removeGroupMember={onRemoveGroupMember}
                on:changeGroupRole={onChangeGroupRole}
                on:cancelGroupInvite={onCancelGroupInvite}
                on:cancelCommunityInvite={onCancelCommunityInvite}
                on:close={popRightPanelHistory} />
        {:else}
            <Members
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                collection={$selectedCommunity}
                invited={$currentCommunityInvited}
                members={[...$currentCommunityMembers.values()]}
                blocked={$currentCommunityBlocked}
                lapsed={$currentCommunityLapsed}
                initialUsergroup={lastState.userGroupId}
                installedBots={$currentCommunityBots}
                apiKeys={$currentCommunityApiKeys}
                on:close={popRightPanelHistory}
                on:blockUser={onBlockCommunityUser}
                on:unblockUser={onUnblockCommnityUser}
                on:showInviteUsers={showInviteCommunityUsers}
                on:removeMember={onRemoveCommunityMember}
                on:changeRole={onChangeCommunityRole}
                on:cancelInvite={onCancelCommunityInvite} />
        {/if}
    {:else if lastState.kind === "invite_group_users" && $multiUserChat !== undefined}
        {#if $multiUserChat.kind === "channel" && $selectedCommunity !== undefined}
            <ChannelOrCommunityInvite
                channel={$multiUserChat}
                community={$selectedCommunity}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                selectedTab="channel"
                on:inviteCommunityUsers={inviteCommunityUsers}
                on:inviteChannelUsers={inviteGroupUsers}
                on:cancelInviteUsers={popRightPanelHistory} />
        {:else}
            <InviteUsers
                container={$multiUserChat}
                {level}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                isCommunityPublic={$selectedCommunity?.public ?? true}
                on:inviteUsers={inviteGroupUsers}
                on:cancelInviteUsers={popRightPanelHistory} />
        {/if}
    {:else if lastState.kind === "show_group_members" && $selectedChatId !== undefined && $multiUserChat !== undefined && $multiUserChat.kind === "group_chat"}
        <Members
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            collection={$multiUserChat}
            invited={$currentChatInvited}
            members={$currentChatMembers}
            blocked={$currentChatBlocked}
            lapsed={$currentChatLapsedMembers}
            installedBots={$currentChatBots}
            apiKeys={$currentChatApiKeys}
            on:close={popRightPanelHistory}
            on:blockUser={onBlockGroupUser}
            on:unblockUser={onUnblockGroupUser}
            on:showInviteUsers={showInviteGroupUsers}
            on:removeMember={onRemoveGroupMember}
            on:changeRole={onChangeGroupRole}
            on:cancelInvite={onCancelGroupInvite} />
    {:else if lastState.kind === "show_group_members" && $selectedChatId !== undefined && $multiUserChat !== undefined && $multiUserChat.kind === "channel" && $selectedCommunity !== undefined}
        <ChannelOrCommunityMembers
            selectedTab="channel"
            channel={$multiUserChat}
            community={$selectedCommunity}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            on:showInviteCommunityUsers={showInviteCommunityUsers}
            on:removeCommunityMember={onRemoveCommunityMember}
            on:changeCommunityRole={onChangeCommunityRole}
            on:blockCommunityUser={onBlockCommunityUser}
            on:unblockCommunityUser={onUnblockCommnityUser}
            on:blockGroupUser={onBlockGroupUser}
            on:unblockGroupUser={onUnblockGroupUser}
            on:removeGroupMember={onRemoveGroupMember}
            on:changeGroupRole={onChangeGroupRole}
            on:close={popRightPanelHistory}
            on:cancelGroupInvite={onCancelGroupInvite}
            on:cancelCommunityInvite={onCancelCommunityInvite} />
    {:else if lastState.kind === "show_pinned" && $selectedChatId !== undefined && ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel") && $multiUserChat !== undefined}
        <PinnedMessages
            on:goToMessageIndex={goToMessageIndex}
            chatId={$selectedChatId}
            pinned={$currentChatPinnedMessages}
            dateLastPinned={$multiUserChat.dateLastPinned}
            on:close={popRightPanelHistory} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => client.setSoftDisabled(true)}
            {user}
            on:closeProfile={popRightPanelHistory} />
    {:else if threadRootEvent !== undefined && $selectedChat !== undefined}
        <Thread
            on:claimDailyChit
            rootEvent={threadRootEvent}
            chat={$selectedChat}
            on:removePreview
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChat !== undefined}
        <ProposalGroupFilters selectedChat={$selectedChat} on:close={popRightPanelHistory} />
    {:else if lastState.kind === "community_details" && $selectedCommunity !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunitySummary
                channel={$multiUserChat}
                community={$selectedCommunity}
                memberCount={$currentChatMembers.length}
                selectedTab="community"
                on:editGroup
                on:editCommunity
                on:close={popRightPanelHistory} />
        {:else}
            <CommunityDetails on:editCommunity />
        {/if}
    {:else if lastState.kind === "community_filters"}
        <CommunityFilters on:close={popRightPanelHistory} />
    {/if}

    <Resizable {modal} {section} bind:resizedWidth bind:resized bind:resizing />
</section>

<style lang="scss">
    :global(body.witch section.right.empty) {
        background: var(--panel-right-bg);
    }

    section {
        overflow: auto;
        overflow-x: hidden;
        flex: 7;
        display: flex;
        flex-direction: column;

        border-left: var(--bw) solid var(--bd);
        background: var(--panel-right-bg);
        max-width: 500px;
        position: relative;

        @include size-above(xxl) {
            flex: 5;
        }

        &.resizing {
            user-select: none;
        }

        &:not(.modal).resized {
            flex: 0 0 var(--resized-width);
        }

        &.modal {
            background: var(--panel-right-modal);
            height: 100%;
            min-width: 500px;

            &.resized {
                width: var(--resized-width);
                @include mobile() {
                    width: 100%;
                }
            }

            @include mobile() {
                min-width: unset;
            }
        }

        &.resized {
            max-width: none;
        }

        @include mobile() {
            background: var(--panel-right-modal);
            width: 100%;
            height: 100%;
            min-width: 0;
            max-width: none;
            border-left: none;
        }

        &.empty {
            background: transparent;
        }

        &.halloween::after {
            @include cobweb();
            bottom: 0;
            right: 0;
            transform: scaleY(-1);
        }
    }
</style>
