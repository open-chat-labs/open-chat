
<script lang="ts">
    import { searchToInvite } from "@src/logic/members/memberManagement.svelte";
    import { navigate } from "@utils/navigation";
    import type { ChatIdentifier, MemberRole, MultiUserChat, OpenChat, UserSummary } from "@client";
    import { allUsersStore, currentUserIdStore, eventsStore, fullWidth, lastRightPanelState, publish, rightPanelHistory, rightPanelView, routeStore, selectedChatBlockedUsersStore, selectedChatBotsStore, selectedChatIdStore, selectedChatInvitedUsersStore, selectedChatLapsedMembersStore, selectedChatMembersStore, selectedChatPinnedMessagesStore, selectedChatSummaryStore, selectedChatWebhooksStore, selectedCommunityBlockedUsersStore, selectedCommunityBotsStore, selectedCommunityInvitedUsersStore, selectedCommunityLapsedMembersStore, selectedCommunityMembersStore, selectedCommunitySummaryStore, setRightPanelHistory } from "@client";
    import {
        MemberManagement,
        type MemberActionOutcome,
    } from "@src/logic/members/memberManagement.svelte";
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
        return searchToInvite(client, level, term);
    }

    function searchMembers(term: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchCommunityMembersToAdd(term, 20);
    }

    // The selected group or channel, and the selected community, whose members the panels act on
    let chatMembers = $derived(
        multiUserChat?.kind === "group_chat" || multiUserChat?.kind === "channel"
            ? new MemberManagement(client, multiUserChat)
            : undefined,
    );
    let communityMembers = $derived(
        $selectedCommunitySummaryStore !== undefined
            ? new MemberManagement(client, $selectedCommunitySummaryStore)
            : undefined,
    );

    async function showOutcome(action: Promise<MemberActionOutcome> | undefined) {
        if (action !== undefined) toastStore.showOutcome(await action);
    }

    type RoleChange = { userId: string; newRole: MemberRole; oldRole: MemberRole };
    const onChangeGroupRole = (args: RoleChange) => showOutcome(chatMembers?.changeRole(args, $_));
    const onChangeCommunityRole = (args: RoleChange) =>
        showOutcome(communityMembers?.changeRole(args, $_));
    const onRemoveGroupMember = (userId: string) => showOutcome(chatMembers?.removeMember(userId));
    const onRemoveCommunityMember = (userId: string) =>
        showOutcome(communityMembers?.removeMember(userId));
    const onBlockGroupUser = (userId: string) => showOutcome(chatMembers?.blockUser(userId));
    const onBlockCommunityUser = (userId: string) =>
        showOutcome(communityMembers?.blockUser(userId));
    const onUnblockGroupUser = (userId: string) => showOutcome(chatMembers?.unblockUser(userId));
    const onUnblockCommunityUser = (userId: string) =>
        showOutcome(communityMembers?.unblockUser(userId));
    const onCancelGroupInvite = (userId: string) => showOutcome(chatMembers?.cancelInvite(userId));
    const onCancelCommunityInvite = (userId: string) =>
        showOutcome(communityMembers?.cancelInvite(userId));

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
        navigate(stripThreadFromUrl(removeQueryStringParam("open")));
        activeVideoCall.threadOpen(false);
    }

    function onShowInviteGroupUsers() {
        publish("showInviteGroupUsers", true);
    }

    function showInviteCommunityUsers() {
        if ($selectedCommunitySummaryStore !== undefined) {
            setRightPanelHistory([{ kind: "invite_community_users" }]);
        }
    }

    let view = $derived(
        rightPanelView({
            panel: $lastRightPanelState,
            chatKind: $selectedChatSummaryStore?.kind,
            inCommunity: $selectedCommunitySummaryStore !== undefined,
            events: $eventsStore,
        }),
    );

    // the level the invite panels' user search invites to
    let level = $derived(
        view.kind === "invite_users"
            ? view.level
            : view.kind === "channel_or_community_invite"
              ? view.tab
              : "group",
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
    <!-- which panel shows is rightPanelView's; the store checks below only narrow the types -->
    {#if view.kind === "channel_summary" && multiUserChat?.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
        <ChannelOrCommunitySummary
            channel={multiUserChat}
            community={$selectedCommunitySummaryStore}
            memberCount={multiUserChat.memberCount}
            selectedTab={view.tab}
            onClose={client.popRightPanelHistory} />
    {:else if view.kind === "group_details" && $selectedChatSummaryStore?.kind === "group_chat"}
        <GroupDetails
            chat={$selectedChatSummaryStore}
            memberCount={$selectedChatSummaryStore.memberCount}
            onClose={client.popRightPanelHistory} />
    {:else if view.kind === "direct_chat_details" && $selectedChatSummaryStore?.kind === "direct_chat"}
        <DirectChatDetails chat={$selectedChatSummaryStore} onClose={client.popRightPanelHistory} />
    {:else if view.kind === "call_participants"}
        <ActiveCallParticipants
            isOwner={view.isOwner}
            chatId={view.chatId}
            onClose={client.popRightPanelHistory}
            messageId={view.messageId} />
    {:else if view.kind === "channel_or_community_invite" && multiUserChat?.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
        <ChannelOrCommunityInvite
            channel={multiUserChat}
            community={$selectedCommunitySummaryStore}
            userLookup={searchUsers}
            memberLookup={view.tab === "channel" ? searchMembers : undefined}
            busy={invitingUsers}
            {closeIcon}
            selectedTab={view.tab}
            {onInviteCommunityUsers}
            onInviteChannelUsers={onInviteGroupUsers}
            onCancelInviteUsers={client.popRightPanelHistory} />
    {:else if view.kind === "invite_users" && view.level === "community" && $selectedCommunitySummaryStore !== undefined}
        <InviteUsers
            {level}
            container={$selectedCommunitySummaryStore}
            userLookup={searchUsers}
            busy={invitingUsers}
            {closeIcon}
            isCommunityPublic={$selectedCommunitySummaryStore?.public ?? true}
            onInviteUsers={onInviteCommunityUsers}
            onCancelInviteUsers={client.popRightPanelHistory} />
    {:else if view.kind === "invite_users" && multiUserChat !== undefined}
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
    {:else if view.kind === "channel_or_community_members" && multiUserChat?.kind === "channel" && $selectedCommunitySummaryStore !== undefined}
        <ChannelOrCommunityMembers
            channel={multiUserChat}
            community={$selectedCommunitySummaryStore}
            {closeIcon}
            selectedTab={view.tab}
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
    {:else if view.kind === "community_members" && $selectedCommunitySummaryStore !== undefined}
        <Members
            {closeIcon}
            collection={$selectedCommunitySummaryStore}
            invited={$selectedCommunityInvitedUsersStore}
            members={[...$selectedCommunityMembersStore.values()]}
            blocked={$selectedCommunityBlockedUsersStore}
            lapsed={$selectedCommunityLapsedMembersStore}
            initialUsergroup={view.userGroupId}
            installedBots={$selectedCommunityBotsStore}
            onClose={client.popRightPanelHistory}
            onBlockUser={onBlockCommunityUser}
            onUnblockUser={onUnblockCommunityUser}
            onShowInviteUsers={showInviteCommunityUsers}
            onRemoveMember={onRemoveCommunityMember}
            onChangeRole={onChangeCommunityRole}
            onCancelInvite={onCancelCommunityInvite} />
    {:else if view.kind === "group_members" && multiUserChat?.kind === "group_chat"}
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
    {:else if view.kind === "pinned" && multiUserChat !== undefined && $selectedChatIdStore !== undefined && ($selectedChatIdStore.kind === "group_chat" || $selectedChatIdStore.kind === "channel")}
        <PinnedMessages
            chatId={$selectedChatIdStore}
            pinned={$selectedChatPinnedMessagesStore}
            dateLastPinned={multiUserChat.dateLastPinned}
            onClose={client.popRightPanelHistory} />
    {:else if view.kind === "user_profile"}
        <UserProfile
            onUnsubscribeNotifications={() => client.setSoftDisabled(true)}
            {user}
            onCloseProfile={client.popRightPanelHistory} />
    {:else if view.kind === "thread" && $selectedChatSummaryStore !== undefined}
        <Thread
            rootEvent={view.rootEvent}
            chat={$selectedChatSummaryStore}
            onCloseThread={closeThread} />
    {:else if view.kind === "proposal_filters" && $selectedChatSummaryStore !== undefined}
        <ProposalGroupFilters
            selectedChat={$selectedChatSummaryStore}
            onClose={client.popRightPanelHistory} />
    {:else if view.kind === "community_details"}
        <CommunityDetails />
    {:else if view.kind === "community_filters"}
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
