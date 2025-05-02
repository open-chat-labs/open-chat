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
        app,
        compareRoles,
        eventsStore,
        pageReplace,
        pathState,
        publish,
        selectedChatStore as selectedChat,
        ui,
        userStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { Readable } from "svelte/store";
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

    let user = $derived($userStore.get(app.currentUserId) ?? client.nullUser("unknown"));
    let modal = $derived(!ui.fullWidth);
    let multiUserChat = $derived(selectedChat as Readable<MultiUserChat>);
    let empty = $derived(ui.rightPanelHistory.length === 0);
    let closeIcon = $derived<"back" | "close">(ui.rightPanelHistory.length > 1 ? "back" : "close");

    function searchUsers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        const canInvite =
            app.selectedCommunitySummary !== undefined &&
            client.canInviteUsers(app.selectedCommunitySummary.id);
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
            app.selectedChatId !== undefined &&
            (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel")
        ) {
            let { userId, newRole, oldRole } = args;
            changeGroupRole(app.selectedChatId, userId, newRole, oldRole);
        }
    }

    function onChangeCommunityRole(args: {
        userId: string;
        newRole: MemberRole;
        oldRole: MemberRole;
    }): void {
        if (app.selectedCommunitySummary !== undefined) {
            const { userId, newRole, oldRole } = args;
            changeCommunityRole(app.selectedCommunitySummary.id, userId, newRole, oldRole);
        }
    }

    function onRemoveGroupMember(userId: string): void {
        if (
            app.selectedChatId !== undefined &&
            (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel")
        ) {
            removeGroupMember(app.selectedChatId, userId);
        }
    }

    function onRemoveCommunityMember(userId: string): void {
        if (app.selectedCommunitySummary !== undefined) {
            removeCommunityMember(app.selectedCommunitySummary.id, userId);
        }
    }

    async function onInviteCommunityUsers(users: UserSummary[]) {
        if (app.selectedCommunitySummary !== undefined) {
            const userIds = users.map((u) => u.userId);

            invitingUsers = true;

            await client.inviteUsers(app.selectedCommunitySummary.id, userIds).then((resp) => {
                if (resp) {
                    ui.popRightPanelHistory();
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
                        ui.popRightPanelHistory();
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

    function stripThreadFromUrl(path: string) {
        if (
            (pathState.route.kind === "global_chat_selected_route" ||
                pathState.route.kind === "selected_channel_route") &&
            pathState.route.threadMessageIndex !== undefined
        ) {
            return removeThreadMessageIndex(pathState.route.threadMessageIndex, path);
        }
        return path;
    }

    function closeThread(_id: ChatIdentifier) {
        ui.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
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
            app.selectedChatId !== undefined &&
            (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel")
        ) {
            const success = await client.blockUser(app.selectedChatId, args.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        }
    }

    async function onBlockCommunityUser(args: { userId: string }) {
        if (app.selectedCommunitySummary !== undefined) {
            const success = await client.blockCommunityUser(
                app.selectedCommunitySummary.id,
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
            app.selectedChatId !== undefined &&
            (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel")
        ) {
            const success = await client.unblockUser(app.selectedChatId, user.userId);
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        }
    }

    async function onUnblockCommunityUser(user: UserSummary) {
        if (app.selectedCommunitySummary !== undefined) {
            const success = await client.unblockCommunityUser(
                app.selectedCommunitySummary.id,
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
        if (app.selectedCommunitySummary !== undefined) {
            ui.rightPanelHistory = [{ kind: "invite_community_users" }];
        }
    }

    function onCancelCommunityInvite(userId: string) {
        if (app.selectedCommunitySummary !== undefined) {
            cancelInvite(app.selectedCommunitySummary.id, userId);
        }
    }

    async function onCancelGroupInvite(userId: string) {
        if (
            app.selectedChatId !== undefined &&
            (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel")
        ) {
            cancelInvite(app.selectedChatId, userId);
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
        ui.lastRightPanelState.kind === "message_thread_panel" && app.selectedChatId !== undefined
            ? findMessage($eventsStore, ui.lastRightPanelState.threadRootMessageId)
            : undefined,
    );

    let level = $derived(
        (ui.lastRightPanelState.kind === "invite_community_users"
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
    {#if ui.lastRightPanelState.kind === "group_details" && app.selectedChatId !== undefined && $multiUserChat !== undefined}
        {#if $multiUserChat.kind === "channel" && app.selectedCommunitySummary !== undefined}
            <ChannelOrCommunitySummary
                channel={$multiUserChat}
                memberCount={app.selectedChat.members.size}
                community={app.selectedCommunitySummary}
                selectedTab="channel"
                onClose={ui.popRightPanelHistory} />
        {:else}
            <GroupDetails
                chat={$multiUserChat}
                memberCount={app.selectedChat.members.size}
                onClose={ui.popRightPanelHistory} />
        {/if}
    {:else if ui.lastRightPanelState.kind === "call_participants_panel"}
        <ActiveCallParticipants
            isOwner={ui.lastRightPanelState.isOwner}
            chatId={ui.lastRightPanelState.chatId}
            onClose={ui.popRightPanelHistory}
            messageId={ui.lastRightPanelState.messageId} />
    {:else if ui.lastRightPanelState.kind === "invite_community_users" && app.selectedCommunitySummary !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel" && app.selectedCommunitySummary !== undefined}
            <ChannelOrCommunityInvite
                channel={$multiUserChat}
                community={app.selectedCommunitySummary}
                userLookup={searchUsers}
                busy={invitingUsers}
                {closeIcon}
                selectedTab="community"
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={ui.popRightPanelHistory} />
        {:else}
            <InviteUsers
                {level}
                container={app.selectedCommunitySummary}
                userLookup={searchUsers}
                busy={invitingUsers}
                {closeIcon}
                isCommunityPublic={app.selectedCommunitySummary?.public ?? true}
                onInviteUsers={onInviteCommunityUsers}
                onCancelInviteUsers={ui.popRightPanelHistory} />
        {/if}
    {:else if ui.lastRightPanelState.kind === "show_community_members" && app.selectedCommunitySummary !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunityMembers
                channel={$multiUserChat}
                community={app.selectedCommunitySummary}
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
                onClose={ui.popRightPanelHistory} />
        {:else}
            <Members
                {closeIcon}
                collection={app.selectedCommunitySummary}
                invited={app.selectedCommunity.invitedUsers}
                members={[...app.selectedCommunity.members.values()]}
                blocked={app.selectedCommunity.blockedUsers}
                lapsed={app.selectedCommunity.lapsedMembers}
                initialUsergroup={ui.lastRightPanelState.userGroupId}
                installedBots={app.selectedCommunity.bots}
                apiKeys={app.selectedCommunity.apiKeys}
                onClose={ui.popRightPanelHistory}
                onBlockUser={onBlockCommunityUser}
                onUnblockUser={onUnblockCommunityUser}
                onShowInviteUsers={showInviteCommunityUsers}
                onRemoveMember={onRemoveCommunityMember}
                onChangeRole={onChangeCommunityRole}
                onCancelInvite={onCancelCommunityInvite} />
        {/if}
    {:else if ui.lastRightPanelState.kind === "invite_group_users" && $multiUserChat !== undefined}
        {#if $multiUserChat.kind === "channel" && app.selectedCommunitySummary !== undefined}
            <ChannelOrCommunityInvite
                channel={$multiUserChat}
                community={app.selectedCommunitySummary}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                {closeIcon}
                selectedTab="channel"
                {onInviteCommunityUsers}
                onInviteChannelUsers={onInviteGroupUsers}
                onCancelInviteUsers={ui.popRightPanelHistory} />
        {:else}
            <InviteUsers
                container={$multiUserChat}
                {level}
                userLookup={searchUsers}
                memberLookup={searchMembers}
                busy={invitingUsers}
                {closeIcon}
                isCommunityPublic={app.selectedCommunitySummary?.public ?? true}
                onInviteUsers={onInviteGroupUsers}
                onCancelInviteUsers={ui.popRightPanelHistory} />
        {/if}
    {:else if ui.lastRightPanelState.kind === "show_group_members" && app.selectedChatId !== undefined && $multiUserChat !== undefined && $multiUserChat.kind === "group_chat"}
        <Members
            {closeIcon}
            collection={$multiUserChat}
            invited={app.selectedChat.invitedUsers}
            members={[...app.selectedChat.members.values()]}
            blocked={app.selectedChat.blockedUsers}
            lapsed={app.selectedChat.lapsedMembers}
            installedBots={app.selectedChat.bots}
            apiKeys={app.selectedChat.apiKeys}
            webhooks={app.selectedChat.webhooks}
            onClose={ui.popRightPanelHistory}
            onBlockUser={onBlockGroupUser}
            onUnblockUser={onUnblockGroupUser}
            onShowInviteUsers={onShowInviteGroupUsers}
            onRemoveMember={onRemoveGroupMember}
            onChangeRole={onChangeGroupRole}
            onCancelInvite={onCancelGroupInvite} />
    {:else if ui.lastRightPanelState.kind === "show_group_members" && app.selectedChatId !== undefined && $multiUserChat !== undefined && $multiUserChat.kind === "channel" && app.selectedCommunitySummary !== undefined}
        <ChannelOrCommunityMembers
            selectedTab="channel"
            channel={$multiUserChat}
            community={app.selectedCommunitySummary}
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
            onClose={ui.popRightPanelHistory}
            {onCancelGroupInvite}
            {onCancelCommunityInvite} />
    {:else if ui.lastRightPanelState.kind === "show_pinned" && app.selectedChatId !== undefined && (app.selectedChatId.kind === "group_chat" || app.selectedChatId.kind === "channel") && $multiUserChat !== undefined}
        <PinnedMessages
            chatId={app.selectedChatId}
            pinned={app.selectedChat.pinnedMessages}
            dateLastPinned={$multiUserChat.dateLastPinned}
            onClose={ui.popRightPanelHistory} />
    {:else if ui.lastRightPanelState.kind === "user_profile"}
        <UserProfile
            onUnsubscribeNotifications={() => client.setSoftDisabled(true)}
            {user}
            onCloseProfile={ui.popRightPanelHistory} />
    {:else if threadRootEvent !== undefined && $selectedChat !== undefined}
        <Thread rootEvent={threadRootEvent} chat={$selectedChat} onCloseThread={closeThread} />
    {:else if ui.lastRightPanelState.kind === "proposal_filters" && $selectedChat !== undefined}
        <ProposalGroupFilters selectedChat={$selectedChat} onClose={ui.popRightPanelHistory} />
    {:else if ui.lastRightPanelState.kind === "community_details" && app.selectedCommunitySummary !== undefined}
        {#if $multiUserChat !== undefined && $multiUserChat.kind === "channel"}
            <ChannelOrCommunitySummary
                channel={$multiUserChat}
                community={app.selectedCommunitySummary}
                memberCount={app.selectedChat.members.size}
                selectedTab="community"
                onClose={ui.popRightPanelHistory} />
        {:else}
            <CommunityDetails />
        {/if}
    {:else if ui.lastRightPanelState.kind === "community_filters"}
        <CommunityFilters onClose={ui.popRightPanelHistory} />
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
