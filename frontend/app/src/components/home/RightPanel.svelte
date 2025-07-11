<script lang="ts">
    import type {
        ChatEvent,
        ChatIdentifier,
        CommunityIdentifier,
        EventWrapper,
        Level,
        MemberRole,
        Message,
        MultiUserChat,
        MultiUserChatIdentifier,
        OpenChat,
        UserSummary,
    } from "openchat-client";
    import {
        allUsersStore,
        compareRoles,
        currentUserIdStore,
        eventsStore,
        fullWidth,
        lastRightPanelState,
        pageReplace,
        publish,
        rightPanelHistory,
        roleAsText,
        routeStore,
        selectedChatBlockedUsersStore,
        selectedChatBotsStore,
        selectedChatIdStore,
        selectedChatInvitedUsersStore,
        selectedChatLapsedMembersStore,
        selectedChatMembersStore,
        selectedChatPinnedMessagesStore,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        selectedCommunityBlockedUsersStore,
        selectedCommunityBotsStore,
        selectedCommunityInvitedUsersStore,
        selectedCommunityLapsedMembersStore,
        selectedCommunityMembersStore,
        selectedCommunitySummaryStore,
        setRightPanelHistory,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall } from "../../stores/video";
    import { currentTheme } from "../../theme/themes";
    import { removeQueryStringParam, removeThreadMessageIndex } from "../../utils/urls";
    import Resizable from "../Resizable.svelte";
    import ChannelOrCommunityInvite from "./ChannelOrCommunityInvite.svelte";
    import ChannelOrCommunityMembers from "./ChannelOrCommunityMembers.svelte";
    import ChannelOrCommunitySummary from "./ChannelOrCommunitySummary.svelte";
    import CommunityDetails from "./communities/details/CommunitySummary.svelte";
    import CommunityFilters from "./communities/explore/Filters.svelte";
    import DirectChatDetails from "./groupdetails/DirectChatDetails.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import InviteUsers from "./groupdetails/InviteUsers.svelte";
    import Members from "./groupdetails/Members.svelte";
    import PinnedMessages from "./pinned/PinnedMessages.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import ProposalGroupFilters from "./ProposalGroupFilters.svelte";
    import Thread from "./thread/Thread.svelte";
    import ActiveCallParticipants from "./video/ActiveCallParticipants.svelte";

    const client = getContext<OpenChat>("client");

    let invitingUsers = $state(false);
    let section: HTMLElement | undefined = $state();
    let resized = $state(false);
    let resizing = $state(false);
    let resizedWidth = $state("7");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let modal = $derived(!$fullWidth);
    let multiUserChat = $derived($selectedChatSummaryStore as MultiUserChat | undefined);
    let empty = $derived($rightPanelHistory.length === 0);
    let closeIcon = $derived<"back" | "close">($rightPanelHistory.length > 1 ? "back" : "close");

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            $selectedCommunitySummaryStore !== undefined &&
            client.canInviteUsers($selectedCommunitySummaryStore.id);
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
            $selectedChatIdStore !== undefined &&
            ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")
        ) {
            let { userId, newRole, oldRole } = args;
            changeGroupRole($selectedChatIdStore, userId, newRole, oldRole);
        }
    }

    function onChangeCommunityRole(args: {
        userId: string;
        newRole: MemberRole;
        oldRole: MemberRole;
    }): void {
        if ($selectedCommunitySummaryStore !== undefined) {
            const { userId, newRole, oldRole } = args;
            changeCommunityRole($selectedCommunitySummaryStore.id, userId, newRole, oldRole);
        }
    }

    function onRemoveGroupMember(userId: string): void {
        if (
            $selectedChatIdStore !== undefined &&
            ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")
        ) {
            removeGroupMember($selectedChatIdStore, userId);
        }
    }

    function onRemoveCommunityMember(userId: string): void {
        if ($selectedCommunitySummaryStore !== undefined) {
            removeCommunityMember($selectedCommunitySummaryStore.id, userId);
        }
    }

    async function onInviteCommunityUsers(users: UserSummary[]) {
        if ($selectedCommunitySummaryStore !== undefined) {
            const userIds = users.map((u) => u.userId);

            invitingUsers = true;

            await client.inviteUsers($selectedCommunitySummaryStore.id, userIds).then((resp) => {
                if (resp) {
                    client.popRightPanelHistory();
                    if (multiUserChat?.public ?? false) {
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
            multiUserChat !== undefined &&
            (multiUserChat.id.kind === "group_chat" || multiUserChat.id.kind === "channel")
        ) {
            const userIds = users.map((u) => u.userId);

            invitingUsers = true;

            await client
                .inviteUsers(multiUserChat.id, userIds)
                .then((resp) => {
                    if (resp) {
                        client.popRightPanelHistory();
                        if (multiUserChat?.public ?? false) {
                            toastStore.showSuccessToast(i18nKey("group.usersInvited"));
                        }
                    } else {
                        toastStore.showFailureToast(
                            i18nKey(
                                "group.inviteUsersFailed",
                                undefined,
                                multiUserChat.level,
                                true,
                            ),
                        );
                    }
                })
                .catch((err) => {
                    client.logError("InviteUsersFailed", err);
                    toastStore.showFailureToast(
                        i18nKey("group.inviteUsersFailed", undefined, multiUserChat.level, true),
                    );
                });

            invitingUsers = false;
        }
    }

    function stripThreadFromUrl(path: string) {
        if (
            ($routeStore.kind === "global_chat_selected_route" ||
                $routeStore.kind === "selected_channel_route") &&
            $routeStore.threadMessageIndex !== undefined
        ) {
            return removeThreadMessageIndex($routeStore.threadMessageIndex, path);
        }
        return path;
    }

    function closeThread(_id: ChatIdentifier) {
        client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
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
                const roleText = $_(roleAsText(newRole));
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
                const roleText = $_(roleAsText(newRole));
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
                if (resp.kind !== "success") {
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
                if (resp.kind !== "success") {
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
            $selectedChatIdStore !== undefined &&
            ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")
        ) {
            const success = await client.blockUser($selectedChatIdStore, args.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onBlockCommunityUser(args: { userId: string }) {
        if ($selectedCommunitySummaryStore !== undefined) {
            const success = await client.blockCommunityUser(
                $selectedCommunitySummaryStore.id,
                args.userId,
            );
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onUnblockGroupUser(user: UserSummary) {
        if (
            $selectedChatIdStore !== undefined &&
            ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")
        ) {
            const success = await client.unblockUser($selectedChatIdStore, user.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    async function onUnblockCommunityUser(user: UserSummary) {
        if ($selectedCommunitySummaryStore !== undefined) {
            const success = await client.unblockCommunityUser(
                $selectedCommunitySummaryStore.id,
                user.userId,
            );
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
        if ($selectedCommunitySummaryStore !== undefined) {
            setRightPanelHistory([{ kind: "invite_community_users" }]);
        }
    }

    function onCancelCommunityInvite(userId: string) {
        if ($selectedCommunitySummaryStore !== undefined) {
            cancelInvite($selectedCommunitySummaryStore.id, userId);
        }
    }

    async function onCancelGroupInvite(userId: string) {
        if (
            $selectedChatIdStore !== undefined &&
            ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")
        ) {
            cancelInvite($selectedChatIdStore, userId);
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
        $lastRightPanelState.kind === "message_thread_panel" && $selectedChatIdStore !== undefined
            ? findMessage($eventsStore, $lastRightPanelState.threadRootMessageId)
            : undefined,
    );

    let level = $derived(
        ($lastRightPanelState.kind === "invite_community_users"
            ? "community"
            : $selectedChatSummaryStore?.kind === "channel"
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
    {#if $lastRightPanelState.kind === "group_details" && $selectedChatIdStore !== undefined && $selectedChatSummaryStore !== undefined}
        {#if $selectedChatSummaryStore.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
            <ChannelOrCommunitySummary
                channel={$selectedChatSummaryStore}
                memberCount={$selectedChatMembersStore.size}
                community={$selectedCommunitySummaryStore}
                selectedTab="channel"
                onClose={client.popRightPanelHistory} />
        {:else if $selectedChatSummaryStore.kind === "group_chat"}
            <GroupDetails
                chat={$selectedChatSummaryStore}
                memberCount={$selectedChatMembersStore.size}
                onClose={client.popRightPanelHistory} />
        {:else if $selectedChatSummaryStore.kind === "direct_chat"}
            <DirectChatDetails
                chat={$selectedChatSummaryStore}
                onClose={client.popRightPanelHistory} />
        {/if}
    {:else if $lastRightPanelState.kind === "call_participants_panel"}
        <ActiveCallParticipants
            isOwner={$lastRightPanelState.isOwner}
            chatId={$lastRightPanelState.chatId}
            onClose={client.popRightPanelHistory}
            messageId={$lastRightPanelState.messageId} />
    {:else if $lastRightPanelState.kind === "invite_community_users" && $selectedCommunitySummaryStore !== undefined}
        {#if multiUserChat !== undefined && multiUserChat.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
            <ChannelOrCommunityInvite
                channel={multiUserChat}
                community={$selectedCommunitySummaryStore}
                userLookup={searchUsers}
                busy={invitingUsers}
                {closeIcon}
                selectedTab="community"
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={client.popRightPanelHistory} />
        {:else}
            <InviteUsers
                {level}
                container={$selectedCommunitySummaryStore}
                userLookup={searchUsers}
                busy={invitingUsers}
                {closeIcon}
                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                onInviteUsers={onInviteCommunityUsers}
                onCancelInviteUsers={client.popRightPanelHistory} />
        {/if}
    {:else if $lastRightPanelState.kind === "show_community_members" && $selectedCommunitySummaryStore !== undefined}
        {#if multiUserChat !== undefined && multiUserChat.kind === "channel"}
            <ChannelOrCommunityMembers
                channel={multiUserChat}
                community={$selectedCommunitySummaryStore}
                {closeIcon}
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
                onClose={client.popRightPanelHistory} />
        {:else}
            <Members
                {closeIcon}
                collection={$selectedCommunitySummaryStore}
                invited={$selectedCommunityInvitedUsersStore}
                members={[...$selectedCommunityMembersStore.values()]}
                blocked={$selectedCommunityBlockedUsersStore}
                lapsed={$selectedCommunityLapsedMembersStore}
                initialUsergroup={$lastRightPanelState.userGroupId}
                installedBots={$selectedCommunityBotsStore}
                onClose={client.popRightPanelHistory}
                onBlockUser={onBlockCommunityUser}
                onUnblockUser={onUnblockCommunityUser}
                onShowInviteUsers={showInviteCommunityUsers}
                onRemoveMember={onRemoveCommunityMember}
                onChangeRole={onChangeCommunityRole}
                onCancelInvite={onCancelCommunityInvite} />
        {/if}
    {:else if $lastRightPanelState.kind === "invite_group_users" && multiUserChat !== undefined}
        {#if multiUserChat.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
            <ChannelOrCommunityInvite
                channel={multiUserChat}
                community={$selectedCommunitySummaryStore}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                {closeIcon}
                selectedTab="channel"
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={client.popRightPanelHistory} />
        {:else}
            <InviteUsers
                container={multiUserChat}
                {level}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                {closeIcon}
                isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
                onInviteUsers={onInviteGroupUsers}
                onCancelInviteUsers={client.popRightPanelHistory} />
        {/if}
    {:else if $lastRightPanelState.kind === "show_group_members" && $selectedChatIdStore !== undefined && multiUserChat !== undefined && multiUserChat.kind === "group_chat"}
        <Members
            {closeIcon}
            collection={multiUserChat}
            invited={$selectedChatInvitedUsersStore}
            members={[...$selectedChatMembersStore.values()]}
            blocked={$selectedChatBlockedUsersStore}
            lapsed={$selectedChatLapsedMembersStore}
            installedBots={$selectedChatBotsStore}
            webhooks={Array.from($selectedChatWebhooksStore.values())}
            onClose={client.popRightPanelHistory}
            onBlockUser={onBlockGroupUser}
            onUnblockUser={onUnblockGroupUser}
            onShowInviteUsers={onShowInviteGroupUsers}
            onRemoveMember={onRemoveGroupMember}
            onChangeRole={onChangeGroupRole}
            onCancelInvite={onCancelGroupInvite} />
    {:else if $lastRightPanelState.kind === "show_group_members" && $selectedChatIdStore !== undefined && multiUserChat !== undefined && multiUserChat.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
        <ChannelOrCommunityMembers
            selectedTab="channel"
            channel={multiUserChat}
            community={$selectedCommunitySummaryStore}
            {closeIcon}
            onShowInviteCommunityUsers={showInviteCommunityUsers}
            {onRemoveCommunityMember}
            {onChangeCommunityRole}
            {onBlockCommunityUser}
            {onUnblockCommunityUser}
            {onBlockGroupUser}
            {onUnblockGroupUser}
            {onRemoveGroupMember}
            {onChangeGroupRole}
            onClose={client.popRightPanelHistory}
            {onCancelGroupInvite}
            {onCancelCommunityInvite} />
    {:else if $lastRightPanelState.kind === "show_pinned" && $selectedChatIdStore !== undefined && ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel") && multiUserChat !== undefined}
        <PinnedMessages
            chatId={$selectedChatIdStore}
            pinned={$selectedChatPinnedMessagesStore}
            dateLastPinned={multiUserChat.dateLastPinned}
            onClose={client.popRightPanelHistory} />
    {:else if $lastRightPanelState.kind === "user_profile"}
        <UserProfile
            onUnsubscribeNotifications={() => client.setSoftDisabled(true)}
            {user}
            onCloseProfile={client.popRightPanelHistory} />
    {:else if threadRootEvent !== undefined && $selectedChatSummaryStore !== undefined}
        <Thread
            rootEvent={threadRootEvent}
            chat={$selectedChatSummaryStore}
            onCloseThread={closeThread} />
    {:else if $lastRightPanelState.kind === "proposal_filters" && $selectedChatSummaryStore !== undefined}
        <ProposalGroupFilters
            selectedChat={$selectedChatSummaryStore}
            onClose={client.popRightPanelHistory} />
    {:else if $lastRightPanelState.kind === "community_details" && $selectedCommunitySummaryStore !== undefined}
        {#if multiUserChat !== undefined && multiUserChat.kind === "channel"}
            <ChannelOrCommunitySummary
                channel={multiUserChat}
                community={$selectedCommunitySummaryStore}
                memberCount={$selectedChatMembersStore.size}
                selectedTab="community"
                onClose={client.popRightPanelHistory} />
        {:else}
            <CommunityDetails />
        {/if}
    {:else if $lastRightPanelState.kind === "community_filters"}
        <CommunityFilters onClose={client.popRightPanelHistory} />
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
