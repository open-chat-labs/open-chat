<script lang="ts">
    import { _ } from "svelte-i18n";
    import { pop } from "../../utils/transition";
    import { numberOfStaleThreadsStore, threadsByChatStore } from "../../stores/chat";
    import { pathParams } from "../../stores/routing";
    import { push } from "svelte-spa-router";
    import { onDestroy } from "svelte";
    import { messagesRead } from "../../stores/markRead";

    $: selected = $pathParams.chatId === "threads";

    let numStaleThreads = 0;

    const unsub = messagesRead.subscribe(() => {
        numStaleThreads = messagesRead.staleThreadsCount($threadsByChatStore);
    });

    function onClick() {
        push("/threads");
    }

    onDestroy(unsub);
</script>

<div role="button" class="threads" class:selected on:click={onClick}>
    <div class="icon">🧵</div>
    <div class="details">
        <h4 class="title" class:unread={$numberOfStaleThreadsStore > 0}>
            {$_("thread.previewTitle")}
        </h4>
    </div>
    {#if $numberOfStaleThreadsStore > 0}
        <div
            in:pop={{ duration: 1500 }}
            title={$_("thread.unread", {
                values: { count: $numberOfStaleThreadsStore.toString() },
            })}
            class="unread-count">
            {$numberOfStaleThreadsStore > 999 ? "999+" : $numberOfStaleThreadsStore}
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
        padding: $sp3;
        margin-bottom: 0;
        gap: 12px;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        border-bottom: var(--chatSummary-bd);
        user-select: none;

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
            @include font(book, normal, fs-100);
            color: var(--chatSummary-txt1);
            @include ellipsis();

            &.unread {
                @include font(bold, normal, fs-100);
            }
        }
    }

    .unread-count {
        @include unread();
    }
</style>
