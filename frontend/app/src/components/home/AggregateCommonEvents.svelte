<svelte:options immutable={true} />

<script lang="ts">
    import type { OpenChat, UserLookup, UserSummary } from "openchat-client";
    import { afterUpdate, createEventDispatcher, getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "./Markdown.svelte";

    export let chatId: string;
    export let user: UserSummary | undefined;
    export let joined: Set<string>;
    export let messagesDeleted: number[];
    export let observer: IntersectionObserver;
    export let readByMe: boolean;

    let deletedMessagesElement: HTMLElement;

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    $: userStore = client.userStore;
    $: joinedText = buildJoinedText($userStore, joined);
    $: deletedText =
        messagesDeleted.length > 0
            ? messagesDeleted.length === 1
                ? $_("oneMessageDeleted")
                : $_("nMessagesDeleted", { values: { number: messagesDeleted.length } })
            : undefined;

    afterUpdate(() => {
        if (readByMe && observer && deletedMessagesElement) {
            observer.unobserve(deletedMessagesElement);
        }
    });

    onMount(() => {
        if (!readByMe && deletedMessagesElement) {
            observer?.observe(deletedMessagesElement);
        }
    });

    onDestroy(() => {
        if (deletedMessagesElement) {
            observer?.unobserve(deletedMessagesElement);
        }
    });

    function buildJoinedText(userStore: UserLookup, userIds: Set<string>): string | undefined {
        return userIds.size > 10
            ? $_("nUsersJoined", {
                  values: {
                      number: userIds.size.toString(),
                  },
              })
            : userIds.size > 0
            ? $_("userJoined", {
                  values: {
                      username: buildUserList(userStore, userIds),
                  },
              })
            : undefined;
    }

    function buildUserList(userStore: UserLookup, userIds: Set<string>): string {
        return client.getMembersString(
            user!,
            userStore,
            Array.from(userIds),
            $_("unknownUser"),
            $_("you"),
            user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername,
            false
        );
    }

    function expandDeletedMessages() {
        const chatMessages = document.getElementById("chat-messages");
        const scrollTop = chatMessages?.scrollTop ?? 0;
        const scrollHeight = chatMessages?.scrollHeight ?? 0;
        client.expandDeletedMessages(chatId, new Set(messagesDeleted));
        dispatch("expandDeletedMessages", { scrollTop, scrollHeight });
    }
</script>

{#if joinedText !== undefined || deletedText !== undefined}
    <div class="timeline-event">
        {#if joinedText !== undefined}
            <Markdown oneLine={true} suppressLinks={true} text={joinedText} />
        {/if}
        {#if deletedText !== undefined}
            <p
                class="deleted"
                title={$_("expandDeletedMessages")}
                bind:this={deletedMessagesElement}
                data-index={messagesDeleted.join(" ")}
                on:click={expandDeletedMessages}>
                {deletedText}
            </p>
        {/if}
    </div>
{/if}

<style type="text/scss">
    .timeline-event {
        max-width: 80%;
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);

        p {
            margin-bottom: $sp3;
            &:last-child {
                margin-bottom: 0;
            }

            &.deleted:hover {
                cursor: pointer;
                text-decoration: underline;
            }
        }
    }
</style>
