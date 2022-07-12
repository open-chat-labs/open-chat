<script lang="ts">
    import { _ } from "svelte-i18n";
    import { numberOfStaleThreadsStore } from "../../stores/chat";
    import { pathParams } from "../../stores/routing";
    import { push } from "svelte-spa-router";

    $: selected = $pathParams.chatId === "threads";

    function onClick() {
        push("/threads");
    }
</script>

<div role="button" class="threads" class:selected on:click={onClick}>
    <div class="icon">🧵</div>
    <div class="details">
        <h4 class="title" class:unread={$numberOfStaleThreadsStore > 0}>
            {$_("thread.previewTitle")}
        </h4>
    </div>
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

        // .name-date {
        //     display: flex;
        //     margin-bottom: $sp1;
        // }

        // .chat-msg {
        //     color: var(--chatSummary-txt2);
        //     @include font(book, normal, fs-80);
        // }
    }
</style>
