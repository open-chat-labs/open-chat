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
    import { getContext } from "svelte";
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
        publish,
    } from "openchat-client";

    interface Props {
        onGoToMessageIndex: (details: { index: number; preserveFocus: boolean }) => void;
    }

    const client = getContext<OpenChat>("client");

    let { onGoToMessageIndex }: Props = $props();
    let invitingUsers = $state(false);
    let section: HTMLElement | undefined = $state();
    let resized = $state(false);
    let resizing = $state(false);
    let resizedWidth = $state("7");

    let user = $derived($userStore.get($currentUser.userId) ?? client.nullUser("unknown"));
    let lastState = $derived(
        $rightPanelHistory[$rightPanelHistory.length - 1] ?? { kind: "no_panel" },
    );
    let modal = $derived(!$fullWidth);
    let multiUserChat = $derived(selectedChat as Readable<MultiUserChat>);
    let empty = $derived($rightPanelHistory.length === 0);

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunity !== undefined && client.canInviteUsers($selectedCommunity.id);
        return client.searchUsersForInvite(term, 20, level, false, canInvite);
    }

    function searchMembers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchCommunityMembersToAdd(term, 20);
    }

    function onChangeGroupRole(args: {
        userId: string;
        newRole: MemberRole;
        oldRole: MemberRole;
    }): void {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            let { userId, newRole, oldRole } = args;
            changeGroupRole($selectedChatId, userId, newRole, oldRole);
        }
    }

    function onChangeCommunityRole(args: {
        userId: string;
        newRole: MemberRole;
        oldRole: MemberRole;
    }): void {
        if ($selectedCommunity !== undefined) {
            const { userId, newRole, oldRole } = args;
            changeCommunityRole($selectedCommunity.id, userId, newRole, oldRole);
        }
    }

    function onRemoveGroupMember(userId: string): void {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            removeGroupMember($selectedChatId, userId);
        }
    }

    function onRemoveCommunityMember(userId: string): void {
        if ($selectedCommunity !== undefined) {
            removeCommunityMember($selectedCommunity.id, userId);
        }
    }

    async function onInviteCommunityUsers(users: UserSummary[]) {
        if ($selectedCommunity !== undefined) {
            const userIds = users.map((u) => u.userId);

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

    async function onInviteGroupUsers(users: UserSummary[]) {
        if (
            $multiUserChat !== undefined &&
            ($multiUserChat.id.kind === "group_chat" || $multiUserChat.id.kind === "channel")
        ) {
            const userIds = users.map((u) => u.userId);

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

    function goToMessageIndex(detail: { index: number; preserveFocus: boolean }): void {
        onGoToMessageIndex(detail);
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

    async function onBlockGroupUser(args: { userId: string }) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            const success = await client.blockUser($selectedChatId, args.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onBlockCommunityUser(args: { userId: string }) {
        if ($selectedCommunity !== undefined) {
            const success = await client.blockCommunityUser($selectedCommunity.id, args.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onUnblockGroupUser(user: UserSummary) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            const success = await client.unblockUser($selectedChatId, user.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    async function onUnblockCommunityUser(user: UserSummary) {
        if ($selectedCommunity !== undefined) {
            const success = await client.unblockCommunityUser($selectedCommunity.id, user.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    function onShowInviteGroupUsers() {
        publish("showInviteGroupUsers", true);
    }

    function showInviteCommunityUsers() {
        if ($selectedCommunity !== undefined) {
            rightPanelHistory.set([{ kind: "invite_community_users" }]);
        }
    }

    function onCancelCommunityInvite(userId: string) {
        if ($selectedCommunity !== undefined) {
            cancelInvite($selectedCommunity.id, userId);
        }
    }

    async function onCancelGroupInvite(userId: string) {
        if (
            $selectedChatId !== undefined &&
            ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel")
        ) {
            cancelInvite($selectedChatId, userId);
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

    let threadRootEvent = $derived(
        lastState.kind === "message_thread_panel" && $selectedChatId !== undefined
            ? findMessage($eventsStore, lastState.threadRootMessageId)
            : undefined,
    );

    let level = $derived(
        (lastState.kind === "invite_community_users"
            ? "community"
            : $selectedChat?.kind === "channel"
              ? "channel"
              : "group") as Level,
    );
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
                onClose={popRightPanelHistory} />
        {:else}
            <GroupDetails
                chat={$multiUserChat}
                memberCount={$currentChatMembers.length}
                onClose={popRightPanelHistory} />
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
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={popRightPanelHistory} />
        {:else}
            <InviteUsers
                {level}
                container={$selectedCommunity}
                userLookup={searchUsers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                isCommunityPublic={$selectedCommunity?.public ?? true}
                on:inviteUsers={onInviteCommunityUsers}
                on:cancelInviteUsers={popRightPanelHistory} />
        {/if}
    {:else if lastState.kind === "show_community_members" && $selectedCommunity !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunityMembers
                channel={$multiUserChat}
                community={$selectedCommunity}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                selectedTab="community"
                onShowInviteCommunityUsers={showInviteCommunityUsers}
                {onRemoveCommunityMember}
                {onChangeCommunityRole}
                {onBlockCommunityUser}
                {onUnblockCommunityUser}
                {onBlockGroupUser}
                {onUnblockGroupUser}
                {onRemoveGroupMember}
                {onChangeGroupRole}
                {onCancelGroupInvite}
                {onCancelCommunityInvite}
                onClose={popRightPanelHistory} />
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
                onClose={popRightPanelHistory}
                onBlockUser={onBlockCommunityUser}
                onUnblockUser={onUnblockCommunityUser}
                onShowInviteUsers={showInviteCommunityUsers}
                onRemoveMember={onRemoveCommunityMember}
                onChangeRole={onChangeCommunityRole}
                onCancelInvite={onCancelCommunityInvite} />
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
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={popRightPanelHistory} />
        {:else}
            <InviteUsers
                container={$multiUserChat}
                {level}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
                isCommunityPublic={$selectedCommunity?.public ?? true}
                on:inviteUsers={onInviteGroupUsers}
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
            onClose={popRightPanelHistory}
            onBlockUser={onBlockGroupUser}
            onUnblockUser={onUnblockGroupUser}
            onShowInviteUsers={onShowInviteGroupUsers}
            onRemoveMember={onRemoveGroupMember}
            onChangeRole={onChangeGroupRole}
            onCancelInvite={onCancelGroupInvite} />
    {:else if lastState.kind === "show_group_members" && $selectedChatId !== undefined && $multiUserChat !== undefined && $multiUserChat.kind === "channel" && $selectedCommunity !== undefined}
        <ChannelOrCommunityMembers
            selectedTab="channel"
            channel={$multiUserChat}
            community={$selectedCommunity}
            closeIcon={$rightPanelHistory.length > 1 ? "back" : "close"}
            onShowInviteCommunityUsers={showInviteCommunityUsers}
            {onRemoveCommunityMember}
            {onChangeCommunityRole}
            {onBlockCommunityUser}
            {onUnblockCommunityUser}
            {onBlockGroupUser}
            {onUnblockGroupUser}
            {onRemoveGroupMember}
            {onChangeGroupRole}
            onClose={popRightPanelHistory}
            {onCancelGroupInvite}
            {onCancelCommunityInvite} />
    {:else if lastState.kind === "show_pinned" && $selectedChatId !== undefined && ($selectedChatId.kind === "group_chat" || $selectedChatId.kind === "channel") && $multiUserChat !== undefined}
        <PinnedMessages
            onGoToMessageIndex={goToMessageIndex}
            chatId={$selectedChatId}
            pinned={$currentChatPinnedMessages}
            dateLastPinned={$multiUserChat.dateLastPinned}
            onClose={popRightPanelHistory} />
    {:else if lastState.kind === "user_profile"}
        <UserProfile
            on:unsubscribeNotifications={() => client.setSoftDisabled(true)}
            {user}
            on:closeProfile={popRightPanelHistory} />
    {:else if threadRootEvent !== undefined && $selectedChat !== undefined}
        <Thread
            rootEvent={threadRootEvent}
            chat={$selectedChat}
            on:removePreview
            on:closeThread={closeThread} />
    {:else if lastState.kind === "proposal_filters" && $selectedChat !== undefined}
        <ProposalGroupFilters selectedChat={$selectedChat} onClose={popRightPanelHistory} />
    {:else if lastState.kind === "community_details" && $selectedCommunity !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunitySummary
                channel={$multiUserChat}
                community={$selectedCommunity}
                memberCount={$currentChatMembers.length}
                selectedTab="community"
                onClose={popRightPanelHistory} />
        {:else}
            <CommunityDetails />
        {/if}
    {:else if lastState.kind === "community_filters"}
        <CommunityFilters onClose={popRightPanelHistory} />
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
