<script lang="ts">
    import type { OpenChat } from "@client";
    import type { AggregateEventText } from "@src/logic/conversation/timelineEventText";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "@src/core/Markdown.svelte";

    interface Props {
        text: AggregateEventText;
        messagesDeleted: number[];
        observer?: IntersectionObserver;
        readByMe: boolean;
    }

    let { text, messagesDeleted, observer, readByMe }: Props = $props();

    let deletedMessagesElement: HTMLElement | undefined = $state();

    const client = getContext<OpenChat>("client");

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

    function expandDeletedMessages() {
        client.expandDeletedMessages(new Set(messagesDeleted));
    }
    let joinedText = $derived(text.joined);
    let deletedText = $derived(text.deleted);
    let roleChangedTextList = $derived(text.rolesChanged);
</script>

{#if joinedText !== undefined || deletedText !== undefined || roleChangedTextList?.length > 0}
    <div class="timeline-event">
        {#if joinedText !== undefined}
            <p>
                <Markdown oneLine suppressLinks text={joinedText} />
            </p>
        {/if}
        {#if deletedText !== undefined}
            <p
                class="deleted"
                title={$_("expandDeletedMessages")}
                bind:this={deletedMessagesElement}
                data-index={messagesDeleted.join(" ")}
                onclick={expandDeletedMessages}>
                {deletedText}
            </p>
        {/if}
        {#each roleChangedTextList as text}
            <p>
                <Markdown suppressLinks {text} />
            </p>
        {/each}
    </div>
{/if}

<style lang="scss">
    .timeline-event {
        max-width: 80%;
        padding: $sp2;
        background-color: var(--timeline-bg);
        margin: 0 auto $sp4 auto;
        text-align: center;
        color: var(--timeline-txt);
        @include font(book, normal, fs-70);

        p {
            margin-bottom: $sp3;
            &:last-child {
                margin-bottom: 0;
            }

            @media (hover: hover) {
                &.deleted:hover {
                    cursor: pointer;
                    text-decoration: underline;
                }
            }
        }
    }
</style>
