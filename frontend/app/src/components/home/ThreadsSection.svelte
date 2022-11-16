<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { pathParams } from "../../stores/routing";
    import { push } from "svelte-spa-router";
    import { getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    $: messagesRead = client.messagesRead;
    $: selected = $pathParams.chatId === "threads";
    $: numStaleThreads = client.staleThreadsCount();

    function onClick() {
        push("/threads");
    }

    onMount(() => {
        return messagesRead.subscribe(() => {
            numStaleThreads = client.staleThreadsCount();
        });
    });
</script>

<div role="button" class="threads" class:selected on:click={onClick}>
    <div class="icon">🧵</div>
    <div class="details">
        <h4 class="title" class:unread={numStaleThreads > 0}>
            {$_("thread.previewTitle")}
        </h4>
    </div>
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

<style type="text/scss">
    .threads {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: $sp4 $sp4;
        margin-bottom: 0;
        gap: 12px;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        border-bottom: var(--chatSummary-bd);
        user-select: none;

        @include mobile() {
            padding: $sp3;
        }

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }
    }

    .icon {
        flex: 0 0 45px;
        @include font-size(fs-180);
        text-align: center;
    }

    .details {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: toRem(48);
        overflow: hidden;

        .title {
            color: var(--chatSummary-txt1);
            @include ellipsis();
        }
    }

    .unread-count {
        @include unread();
    }
</style>
