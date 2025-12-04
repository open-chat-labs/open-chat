<script lang="ts">
    import {
        Avatar,
        ChatFootnote,
        ColourVars,
        Container,
        CountBadge,
        NotificationIndicator,
        type Padding,
        type Radius,
    } from "component-lib";
    import {
        allUsersStore,
        messagesRead,
        OpenChat,
        threadsFollowedByMeStore,
        type ChatIdentifier,
        type ThreadSummary,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";

    const client = getContext<OpenChat>("client");
    const MAX_AVATARS = 3;

    interface Props {
        chatId: ChatIdentifier;
        threadSummary: ThreadSummary;
        threadRootMessageIndex: number;
        me?: boolean;
        url: string;
    }

    let { chatId, url, threadRootMessageIndex, threadSummary, me = false }: Props = $props();

    let lastMessageIndex = $derived(threadSummary.numberOfReplies - 1); //using this as a surrogate for message index for now
    let unreadCount = $derived(
        client.unreadThreadMessageCount(chatId, threadRootMessageIndex, lastMessageIndex),
    );
    let hasUnread = $derived(unreadCount > 0);
    let isFollowedByMe = $derived(
        $threadsFollowedByMeStore.get(chatId)?.has(threadRootMessageIndex) ?? false,
    );
    let borderColour = $derived(
        hasUnread && isFollowedByMe ? ColourVars.primary : ColourVars.disabledButton,
    );
    let borderRadius = $derived<Radius>(me ? ["xl", "sm", "xl", "xl"] : ["sm", "xl", "xl", "xl"]); // this will need more logic
    let padding = $derived<Padding>(me ? ["xs", "md", "xs", "xs"] : ["xs", "xs", "xs", "md"]);
    let participantAvatarUrls = $derived(
        [...threadSummary.participantIds].map((p) => client.userAvatarUrl($allUsersStore.get(p))),
    );
    let additional = $derived(participantAvatarUrls.length - MAX_AVATARS);
    let text = $derived(
        $_("thread.nreplies", {
            values: {
                number: threadSummary.numberOfReplies.toString(),
                replies:
                    threadSummary.numberOfReplies === 1 ? $_("thread.reply") : $_("thread.replies"),
                message: $_("thread.lastMessage", {
                    values: {
                        date: client.formatMessageDate(
                            threadSummary.latestEventTimestamp,
                            $_("today"),
                            $_("yesterday"),
                            true,
                            true,
                        ),
                    },
                }),
            },
        }),
    );

    onMount(() => {
        return messagesRead.subscribe(() => {
            unreadCount = client.unreadThreadMessageCount(
                chatId,
                threadRootMessageIndex,
                lastMessageIndex,
            );
        });
    });
</script>

<Container
    onClick={() => page(url)}
    overflow={"visible"}
    {borderColour}
    borderWidth={"thick"}
    crossAxisAlignment={"center"}
    {borderRadius}
    {padding}
    gap={"md"}
    height={{ kind: "hug" }}
    width={{ kind: "hug" }}>
    <Container supplementalClass={"thread-summary-avatars"} width={{ kind: "hug" }}>
        {#each participantAvatarUrls.slice(0, MAX_AVATARS) as url}
            <Avatar {url} size={"xs"}></Avatar>
        {/each}
        {#if additional > 0}
            <CountBadge mode="additive">+{additional}</CountBadge>
        {/if}
    </Container>
    <ChatFootnote width={{ kind: "hug" }} colour={"textSecondary"}>{text}</ChatFootnote>
    <Container width={{ kind: "hug" }}>
        <div class={`arrow`} class:hasUnread>
            <ChevronRight color={ColourVars.background0} />
        </div>
    </Container>
    {#if hasUnread}
        <div class:me class="notification">
            <NotificationIndicator muted={!isFollowedByMe}></NotificationIndicator>
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.thread-summary-avatars img) {
        margin-inline-start: -0.4rem;
    }

    :global(.thread-summary-avatars .badge) {
        margin-inline-start: -0.4rem;
    }

    :global(.thread-summary-avatars .border:first-child img) {
        margin-inline-start: 0;
    }

    .arrow {
        background-color: var(--secondary-light);
        border-radius: var(--rad-circle);
        height: 16px;
        display: flex;
        &.hasUnread {
            background-color: var(--primary-light);
        }
    }

    .notification {
        position: absolute;
        top: -17px;
        left: -15px;

        &.me {
            left: unset;
            right: -15px;
        }
    }
</style>
