<script lang="ts">
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../../stores/time";

    const client = getContext<OpenChat>("client");
    export let chat: ChatSummary;

    $: userStore = client.userStore;
    $: userId = chat.kind === "direct_chat" ? chat.them : "";
    $: isBot = $userStore[userId]?.kind === "bot";
</script>

{#if chat.kind === "direct_chat"}
    {isBot ? "" : client.formatLastOnlineDate($_, $now, $userStore[chat.them])}
{:else if chat.kind === "group_chat"}
    <div class="wrapper">
        <div class="visibility">
            <div class={`img ${chat.public ? "public" : "private"}`} />
            <div class="name">
                {chat.public ? $_("group.public") : $_("group.private")}
            </div>
        </div>
        <div class="members">
            <span class="num">{chat.memberCount.toLocaleString()}</span>
            {$_("members")}
        </div>
    </div>
{/if}

<style type="text/scss">
    .wrapper {
        display: flex;
        gap: $sp3;
        align-items: center;
        @include font(book, normal, fs-70);
    }

    .visibility {
        display: flex;
        gap: $sp2;
        align-items: center;
        text-transform: uppercase;
        background-color: var(--chatSummary-bg-selected);
        padding: $sp2 $sp3;
        border-radius: $sp3;

        .img {
            background-repeat: no-repeat;
            $size: 12px;
            flex: 0 0 $size;
            width: $size;
            height: $size;

            &.public {
                background-image: url("../assets/unlocked.svg");
            }

            &.private {
                background-image: url("../assets/locked.svg");
            }
        }
    }

    .members {
        .num {
            color: var(--txt);
            font-weight: 700;
        }
    }
</style>
