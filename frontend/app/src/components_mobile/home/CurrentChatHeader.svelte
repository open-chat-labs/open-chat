<script lang="ts">
    import { activeVideoCall } from "@src/stores/video";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { Avatar, Container, SectionHeader } from "component-lib";
    import type { ChatSummary, DiamondMembershipStatus } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        publish,
        restrictToSelectedChat,
        selectedChatIdStore,
        selectedCommunitySummaryStore,
        byContext as typersByContext,
        type OpenChat,
        type TypersByKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import WithVerifiedBadge from "../icons/WithVerifiedBadge.svelte";
    import Translatable from "../Translatable.svelte";
    import Typing from "../Typing.svelte";
    import ChatSubtext from "./ChatSubtext.svelte";
    import CurrentChatMenu from "./CurrentChatMenu.svelte";
    import Badges from "./profile/Badges.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        selectedChatSummary: ChatSummary;
        blocked: boolean;
        readonly: boolean;
        hasPinned: boolean;
        onSearchChat: (search: string) => void;
    }

    let { selectedChatSummary, blocked, readonly, hasPinned, onSearchChat }: Props = $props();

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
    let canStartVideoCalls = $derived(
        !blocked && client.canStartVideoCalls(selectedChatSummary.id),
    );
    let videoCallInProgress = $derived(selectedChatSummary.videoCallInProgress !== undefined);
    let inCall = $derived(
        $activeVideoCall !== undefined &&
            videoCallInProgress &&
            chatIdentifiersEqual($activeVideoCall.chatId, selectedChatSummary?.id),
    );
    let canStartOrJoinVideoCall = $derived(!inCall && (videoCallInProgress || canStartVideoCalls));
    let isPublic = $derived(!client.isChatPrivate(selectedChatSummary));

    function clearSelection() {
        // publish("clearSelection");
        // This *might* be problematic sometimes, but it's close to right than what we had
        history.back();
    }

    function showGroupDetails() {
        if ($selectedChatIdStore !== undefined) {
            if (selectedChatSummary.kind === "direct_chat") {
                publish("directChatDetails", selectedChatSummary);
                return;
            } else {
                publish("groupChatDetails", selectedChatSummary);
                return;
            }
        }
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

    function openUserProfile(ev?: Event) {
        if (hasUserProfile) {
            ev?.target?.dispatchEvent(
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

    function startVideoCall() {
        publish("startVideoCall", {
            chatId: selectedChatSummary.id,
            callType: isPublic ? "broadcast" : "default",
            join: videoCallInProgress,
        });
    }

    let chat = $derived(normaliseChatSummary($now, selectedChatSummary, $typersByContext));
</script>

{#snippet menu()}
    {#if !readonly && !$anonUserStore}
        <CurrentChatMenu
            {hasPinned}
            {selectedChatSummary}
            {blocked}
            onShowGroupDetails={showGroupDetails}
            {onSearchChat} />
    {/if}
{/snippet}

{#snippet action(color: string)}
    <Video {color} />
{/snippet}

<SectionHeader
    onAction={canStartOrJoinVideoCall ? startVideoCall : undefined}
    action={canStartOrJoinVideoCall ? action : undefined}
    menu={!readonly && !$anonUserStore ? menu : undefined}
    onBack={$restrictToSelectedChat ? undefined : clearSelection}>
    {#snippet avatar()}
        <Avatar onClick={openUserProfile} url={chat.avatarUrl} size={"lg"} name={chat.name} />
    {/snippet}

    {#snippet title()}
        <Container onClick={showGroupDetails}>
            {#if isMultiUser && !readonly}
                <WithVerifiedBadge {verified} size={"small"}>
                    <Container gap={"xs"}>
                        {#if $selectedCommunitySummaryStore !== undefined && $chatListScopeStore.kind === "favourite"}
                            <span>
                                {$selectedCommunitySummaryStore.name}
                            </span>
                            <span>{">"}</span>
                            <span>
                                {chat.name}
                            </span>
                        {:else}
                            {chat.name}
                        {/if}
                    </Container>
                </WithVerifiedBadge>
            {:else if hasUserProfile}
                <Container crossAxisAlignment={"center"} gap={"xxs"}>
                    {chat.name ?? chat.username}
                    <Badges
                        uniquePerson={chat.uniquePerson}
                        diamondStatus={chat.diamondStatus}
                        streak={chat.streak}
                        chitEarned={chat.chitEarned} />
                </Container>
            {:else}
                {chat.name}
            {/if}
        </Container>
    {/snippet}

    {#snippet subtitle()}
        <Container onClick={showGroupDetails}>
            {#if blocked}
                <Translatable resourceKey={i18nKey("blocked")} />
            {:else if chat.typing !== undefined}
                {chat.typing} <Typing />
            {:else}
                <ChatSubtext chat={selectedChatSummary} />
            {/if}
        </Container>
    {/snippet}
</SectionHeader>

<style lang="scss">
    .pointer {
        cursor: pointer;
    }

    .username {
        font-weight: 200;
        color: var(--txt-light);
    }
</style>
