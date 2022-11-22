<svelte:options immutable={true} />

<script lang="ts">
    import type { OpenChat, UserLookup, UserSummary } from "openchat-client";
    import { afterUpdate, getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    export let user: UserSummary | undefined;
    export let joined: Set<string>;
    export let messagesDeleted: number[];
    export let observer: IntersectionObserver;
    export let readByMe: boolean;

    let deletedMessagesElement: HTMLElement;

    $: userStore = client.userStore;
    $: joinedText = buildText($userStore, joined, "userJoined");
    $: deletedText = messagesDeleted.length > 0 
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

    function buildText(
        userStore: UserLookup,
        userIds: Set<string>,
        template: string
    ): string | undefined {
        return userIds.size !== 0
            ? $_(template, {
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
</script>

{#if joinedText !== undefined || deletedText !== undefined}
    <div class="timeline-event">
        {#if joinedText !== undefined}
            <p>{joinedText}</p>
        {/if}
        {#if deletedText !== undefined}
            <p bind:this={deletedMessagesElement} data-index={messagesDeleted.join(" ")}>{deletedText}</p>
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
        }
    }
</style>
