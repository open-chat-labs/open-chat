<script lang="ts">
    import {
        AvatarSize,
        routeForChatIdentifier,
        type OpenChat,
        type TypersByKey,
        userStore,
        byContext as typersByContext,
        selectedChatId,
        selectedCommunity,
        chatListScopeStore as chatListScope,
        anonUser,
    } from "openchat-client";
    import page from "page";
    import { mobileWidth } from "../../stores/screenDimensions";
    import CurrentChatMenu from "./CurrentChatMenu.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import ChatSubtext from "./ChatSubtext.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Avatar from "../Avatar.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";
    import type { ChatSummary, DiamondMembershipStatus } from "openchat-client";
    import Typing from "../Typing.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { now } from "../../stores/time";
    import SuspendModal from "./SuspendModal.svelte";
    import { rightPanelHistory } from "../../stores/rightPanel";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ActiveBroadcastSummary from "./video/ActiveBroadcastSummary.svelte";
    import Badges from "./profile/Badges.svelte";
    import ActiveVideoCallResume from "./video/ActiveVideoCallResume.svelte";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let selectedChatSummary: ChatSummary;
    export let blocked: boolean;
    export let readonly: boolean;
    export let hasPinned: boolean;

    let showSuspendUserModal = false;

    $: userId = selectedChatSummary.kind === "direct_chat" ? selectedChatSummary.them.userId : "";
    $: isMultiUser =
        selectedChatSummary.kind === "group_chat" || selectedChatSummary.kind === "channel";
    $: isBot = $userStore.get(userId)?.kind === "bot";
    $: hasUserProfile = !isMultiUser && !isBot;
    $: verified = selectedChatSummary.kind === "group_chat" && selectedChatSummary.verified;

    function clearSelection() {
        dispatch("clearSelection");
    }

    function showGroupDetails() {
        if ($selectedChatId !== undefined) {
            rightPanelHistory.set([
                {
                    kind: "group_details",
                },
            ]);
        }
    }

    function showGroupMembers() {
        dispatch("showGroupMembers");
    }

    function normaliseChatSummary(_now: number, chatSummary: ChatSummary, typing: TypersByKey) {
        switch (chatSummary.kind) {
            case "direct_chat":
                const them = $userStore.get(chatSummary.them.userId);
                return {
                    name: client.displayName(them),
                    diamondStatus: them?.diamondStatus ?? "inactive",
                    streak: client.getStreak(chatSummary.them.userId),
                    avatarUrl: client.userAvatarUrl(them),
                    userId: chatSummary.them.userId,
                    typing: client.getTypingString(
                        $_,
                        $userStore,
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
                    avatarUrl: client.groupAvatarUrl(chatSummary, $selectedCommunity),
                    userId: undefined,
                    username: undefined,
                    typing: client.getTypingString(
                        $_,
                        $userStore,
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
        if ($selectedCommunity !== undefined) {
            page(`/community/${$selectedCommunity.id.communityId}`);
        }
    }

    function navigateToChannel() {
        if ($selectedCommunity !== undefined) {
            page(routeForChatIdentifier("community", selectedChatSummary.id));
        }
    }

    $: chat = normaliseChatSummary($now, selectedChatSummary, $typersByContext);
</script>

{#if showSuspendUserModal}
    <SuspendModal {userId} on:close={() => (showSuspendUserModal = false)} />
{/if}

<SectionHeader shadow flush>
    {#if $mobileWidth}
        <div class="back" class:rtl={$rtlStore} on:click={clearSelection}>
            <HoverIcon>
                {#if $rtlStore}
                    <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
                {:else}
                    <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
                {/if}
            </HoverIcon>
        </div>
    {/if}

    <div class="avatar" class:has-user-profile={hasUserProfile} on:click={openUserProfile}>
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
                        {#if $selectedCommunity !== undefined && $chatListScope.kind === "favourite"}
                            <span on:click={navigateToCommunity} class="pointer">
                                {$selectedCommunity.name}
                            </span>
                            <span>{">"}</span>
                            <span on:click={navigateToChannel} class="pointer">
                                {chat.name}
                            </span>
                        {:else}
                            {chat.name}
                        {/if}
                    </div>
                </WithVerifiedBadge>
            {:else if hasUserProfile}
                <span on:click={openUserProfile} class="user-link">
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
                    on:membersClick={showGroupMembers} />
            {:else}
                <ChatSubtext chat={selectedChatSummary} />
            {/if}
        </div>
    </div>
    <ActiveVideoCallResume />
    {#if !readonly && !$anonUser}
        <CurrentChatMenu
            bind:showSuspendUserModal
            {hasPinned}
            {selectedChatSummary}
            {blocked}
            on:convertGroupToCommunity
            on:importToCommunity
            on:toggleMuteNotifications
            on:showGroupDetails={showGroupDetails}
            on:searchChat
            on:showProposalFilters
            on:makeProposal
            on:startVideoCall
            on:showGroupMembers
            on:createPoll
            on:upgrade
            on:showInviteGroupUsers
            on:leaveGroup />
    {/if}

    <ActiveBroadcastSummary on:startVideoCall />
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
