<script lang="ts">
    import { Avatar, Container, SectionHeader } from "component-lib";
    import type { ChatSummary, DiamondMembershipStatus, GroupChatSummary } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        chatListScopeStore,
        publish,
        restrictToSelectedChat,
        routeForChatIdentifier,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        setRightPanelHistory,
        byContext as typersByContext,
        type OpenChat,
        type TypersByKey,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import Translatable from "../Translatable.svelte";
    import Typing from "../Typing.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import ChatSubtext from "./ChatSubtext.svelte";
    import CurrentChatMenu from "./CurrentChatMenu.svelte";
    import Badges from "./profile/Badges.svelte";
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
            setRightPanelHistory([
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
                    chitEarned: them?.totalChitEarned,
                    avatarUrl: client.userAvatarUrl(them),
                    userId: chatSummary.them.userId,
                    typing: client.getTypingString(
                        $_,
                        $allUsersStore,
                        { chatId: chatSummary.id },
                        typing,
                    ),
                    username: them ? "@" + them.username : undefined,
                    eventsTTL: chatSummary.eventsTTL,
                    uniquePerson: them?.isUniquePerson ?? false,
                };
            default:
                return {
                    name: chatSummary.name,
                    diamondStatus: "inactive" as DiamondMembershipStatus["kind"],
                    streak: 0,
                    chitEarned: undefined,
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

{#snippet menu()}
    {#if !readonly && !$anonUserStore}
        <CurrentChatMenu
            {hasPinned}
            {selectedChatSummary}
            {blocked}
            {onImportToCommunity}
            onShowGroupDetails={showGroupDetails}
            {onSearchChat} />
    {/if}
{/snippet}

<SectionHeader
    menu={!readonly && !$anonUserStore ? menu : undefined}
    onBack={$restrictToSelectedChat ? undefined : clearSelection}>
    {#snippet avatar()}
        <Avatar onClick={openUserProfile} url={chat.avatarUrl} size={"lg"} />
    {/snippet}

    {#snippet title()}
        {#if isMultiUser && !readonly}
            <WithVerifiedBadge {verified} size={"small"}>
                <Container gap={"md"}>
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
                </Container>
            </WithVerifiedBadge>
        {:else if hasUserProfile}
            <span onclick={openUserProfile} class="user-link">
                {chat.name}
            </span>
            <Badges
                uniquePerson={chat.uniquePerson}
                diamondStatus={chat.diamondStatus}
                streak={chat.streak}
                chitEarned={chat.chitEarned} />
            <span class="username">{chat.username}</span>
        {:else}
            {chat.name}
        {/if}
    {/snippet}

    {#snippet subtitle()}
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
    {/snippet}

    {#snippet action()}
        <ActiveVideoCallResume />
        <ActiveBroadcastSummary />
    {/snippet}
</SectionHeader>

<style lang="scss">
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
</style>
