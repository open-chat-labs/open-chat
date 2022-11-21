<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Button from "../Button.svelte";

    export let selected = false;

    const client = getContext<OpenChat>("client");

    $: messagesRead = client.messagesRead;
    $: numStaleThreads = client.staleThreadsCount();

    onMount(() => {
        return messagesRead.subscribe(() => {
            numStaleThreads = client.staleThreadsCount();
        });
    });
</script>

<Button hollow={!selected} small={true} on:click>
    <div class="wrapper">
        <div class="icon">🧵</div>
        <h4 class="title" class:unread={numStaleThreads > 0}>
            {$_("thread.previewTitle")}
        </h4>
        {#if numStaleThreads > 0}
            <div
                in:pop={{ duration: 1500 }}
                title={$_("thread.unread", {
                    values: { count: numStaleThreads.toString() },
                })}
                class="unread-count">
                {numStaleThreads > 999 ? "999+" : numStaleThreads}
            </div>
        {/if}
    </div>
</Button>

<style type="text/scss">
    .wrapper {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
    }

    .icon {
        @include font-size(fs-120);
        text-align: center;
    }

    .unread-count {
        @include unread();
    }
</style>
