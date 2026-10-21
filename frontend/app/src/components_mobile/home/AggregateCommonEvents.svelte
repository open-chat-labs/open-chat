<script lang="ts">
    import { Caption, Container } from "component-lib";
    import type { OpenChat } from "@client";
    import type { AggregateEventText } from "@src/logic/conversation/timelineEventText";
    import { getContext, onDestroy, onMount } from "svelte";
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
    <Container padding={"sm"} crossAxisAlignment={"center"} direction={"vertical"}>
        {#if joinedText !== undefined}
            <Caption width={"hug"} colour={"textSecondary"}>
                <Markdown oneLine suppressLinks text={joinedText} />
            </Caption>
        {/if}
        {#if deletedText !== undefined}
            <div
                bind:this={deletedMessagesElement}
                data-index={messagesDeleted.join(" ")}
                class="deleted">
                <Container onClick={expandDeletedMessages}>
                    <Caption width={"hug"} colour={"textSecondary"}>
                        {deletedText}
                    </Caption>
                </Container>
            </div>
        {/if}
        {#each roleChangedTextList as text}
            <Caption width={"hug"} colour={"textSecondary"}>
                <Markdown suppressLinks {text} />
            </Caption>
        {/each}
    </Container>
{/if}
