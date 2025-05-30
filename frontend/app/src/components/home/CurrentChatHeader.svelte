<script lang="ts">
    import type { ChatSummary, DiamondMembershipStatus, GroupChatSummary } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        AvatarSize,
        chatListScopeStore,
        iconSize,
        mobileWidth,
        publish,
        rightPanelHistory,
        routeForChatIdentifier,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        byContext as typersByContext,
        type OpenChat,
        type TypersByKey,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { rtlStore } from "../../stores/rtl";
    import { now } from "../../stores/time";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import Translatable from "../Translatable.svelte";
    import Typing from "../Typing.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import ChatSubtext from "./ChatSubtext.svelte";
    import CurrentChatMenu from "./CurrentChatMenu.svelte";
    import Badges from "./profile/Badges.svelte";
    import SuspendModal from "./SuspendModal.svelte";
    import ActiveBroadcastSummary from "./video/ActiveBroadcastSummary.svelte";
    import ActiveVideoCallResume from "./video/ActiveVideoCallResume.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedChatSummary: ChatSummary;
        blocked: boolean;
        readonly: boolean;
        hasPinned: boolean;
        onSearchChat: (search: string) => void;
        onImportToCommunity: (group: GroupChatSummary) => void;
    }

    let {
        selectedChatSummary,
        blocked,
        readonly,
        hasPinned,
        onSearchChat,
        onImportToCommunity,
    }: Props = $props();

    let showSuspendUserModal = $state(false);

    let userId = $derived(
        selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them.userId : "",
    );
    let isMultiUser = $derived(
        selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel",
    );
    let isBot = $derived($allUsersStore.get(userId)?.kind === "bot");
    let hasUserProfile = $derived(!isMultiUser && !isBot);
    let verified = $derived(
        selectedChatSummary.kind === "group_chat" && selectedChatSummary.verified,
    );

    function clearSelection() {
        publish("clearSelection");
    }

    function showGroupDetails() {
        if ($selectedChatIdStore !== undefined) {
            rightPanelHistory.set([
                {
                    kind: "group_details",
                },
            ]);
        }
    }

    function showGroupMembers() {
        publish("showGroupMembers");
    }

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        switch (chatSummary.kind) {
            case "direct_chat":
                const them = $allUsersStore.get(chatSummary.them.userId);
                return {
                    name: client.displayName(them),
                    diamondStatus: them?.diamondStatus ?? "inactive",
                    streak: them?.streak ?? 0,
                    avatarUrl: client.userAvatarUrl(them),
                    userId: chatSummary.them.userId,
                    typing: client.getTypingString(
                        $_,
                        $allUsersStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    username: them ? "@" + them.username : undefined,
                    eventsTTL: undefined,
                    uniquePerson: them?.isUniquePerson ?? false,
                };
            default:
                return {
                    name: chatSummary.name,
                    diamondStatus: "inactive" as DiamondMembershipStatus["kind"],
                    streak: 0,
                    avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunitySummaryStore),
                    userId: undefined,
                    username: undefined,
                    typing: client.getTypingString(
                        $_,
                        $allUsersStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    eventsTTL: chatSummary.eventsTTL,
                    uniquePerson: false,
                };
        }
    }

    function openUserProfile(ev: Event) {
        if (hasUserProfile) {
            ev.target?.dispatchEvent(
                new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                    detail: {
                        userId,
                        chatButton: false,
                        inGlobalContext: false,
                    },
                    bubbles: true,
                }),
            );
        }
    }

    function navigateToCommunity() {
        if ($selectedCommunitySummaryStore !== undefined) {
            page(`/community/${$selectedCommunitySummaryStore.id.communityId}`);
        }
    }

    function navigateToChannel() {
        if ($selectedCommunitySummaryStore !== undefined) {
            page(routeForChatIdentifier("community", selectedChatSummary.id));
        }
    }

    let chat = $derived(normaliseChatSummary($now, selectedChatSummary, $typersByContext));
</script>

{#if showSuspendUserModal}
    <SuspendModal {userId} onClose={() => (showSuspendUserModal = false)} />
{/if}

<SectionHeader shadow flush>
    {#if $mobileWidth}
        <div class="back" class:rtl={$rtlStore} onclick={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                {:else}
                    <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}

    <div class="avatar" class:has-user-profile={hasUserProfile} onclick={openUserProfile}>
        <Avatar
            statusBorder={"var(--section-bg)"}
            {blocked}
            showStatus
            userId={chat.userId}
            url={chat.avatarUrl}
            size={AvatarSize.Default} />
    </div>
    <div class="chat-details">
        <div class="chat-name">
            {#if isMultiUser && !readonly}
                <WithVerifiedBadge {verified} size={"small"}>
                    <div class="title">
                        {#if $selectedCommunitySummaryStore !== undefined && $chatListScopeStore.kind === "favourite"}
                            <span onclick={navigateToCommunity} class="pointer">
                                {$selectedCommunitySummaryStore.name}
                            </span>
                            <span>{">"}</span>
                            <span onclick={navigateToChannel} class="pointer">
                                {chat.name}
                            </span>
                        {:else}
                            {chat.name}
                        {/if}
                    </div>
                </WithVerifiedBadge>
            {:else if hasUserProfile}
                <span onclick={openUserProfile} class="user-link">
                    {chat.name}
                </span>
                <Badges
                    uniquePerson={chat.uniquePerson}
                    diamondStatus={chat.diamondStatus}
                    streak={chat.streak} />
                <span class="username">{chat.username}</span>
            {:else}
                {chat.name}
            {/if}
        </div>
        <div class="chat-subtext">
            {#if blocked}
                <Translatable resourceKey={i18nKey("blocked")} />
            {:else if readonly}
                <ChatSubtext chat={selectedChatSummary} />
            {:else if chat.typing !== undefined}
                {chat.typing} <Typing />
            {:else if isMultiUser}
                <ChatSubtext
                    chat={selectedChatSummary}
                    clickableMembers
                    onMembersClick={showGroupMembers} />
            {:else}
                <ChatSubtext chat={selectedChatSummary} />
            {/if}
        </div>
    </div>
    <ActiveVideoCallResume />
    {#if !readonly && !$anonUserStore}
        <CurrentChatMenu
            bind:showSuspendUserModal
            {hasPinned}
            {selectedChatSummary}
            {blocked}
            {onImportToCommunity}
            onShowGroupDetails={showGroupDetails}
            {onSearchChat} />
    {/if}

    <ActiveBroadcastSummary />
</SectionHeader>

<style lang="scss">
    .chat-name {
        @include font(book, normal, fs-120);
        @include ellipsis();
        margin-bottom: $sp1;
        display: flex;
        align-items: center;
        gap: $sp2;
    }

    .chat-subtext {
        @include font(book, normal, fs-80);
        @include ellipsis();
        color: var(--txt-light);
    }

    .avatar {
        flex: 0 0 55px;

        &.has-user-profile {
            cursor: pointer;
        }
    }

    .pointer {
        cursor: pointer;
    }

    .user-link {
        cursor: pointer;
        @media (hover: hover) {
            &:hover {
                text-decoration: underline;
            }
        }
    }

    .username {
        font-weight: 200;
        color: var(--txt-light);
    }

    .chat-details {
        flex: 1;
        overflow: auto;
        padding: 0 $sp2;
    }

    .title {
        display: flex;
        flex-direction: row;
        gap: $sp3;
    }

    .back {
        flex: 0 0 10px;
        margin-right: 5px;

        &.rtl {
            margin-right: 0;
            margin-left: 5px;
        }
    }
</style>
