<script lang="ts">
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../../stores/time";

    const client = getContext<OpenChat>("client");
    export let chat: ChatSummary;

    $: userStore = client.userStore;
    $: userId = chat.kind === "direct_chat" ? chat.them.userId : "";
    $: isBot = $userStore[userId]?.kind === "bot";
    $: isSuspended = $userStore[userId]?.suspended ?? false;
    $: subtext = isSuspended ? $_("accountSuspended") : "";
    $: checkLastOnline = !isSuspended && !isBot && chat.kind === "direct_chat";

    $: {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((lastOnline) => {
                if (lastOnline !== undefined && lastOnline !== 0) {
                    subtext = client.formatLastOnlineDate($_, $now, lastOnline);
                } else {
                    subtext = "";
                }
            });
        }
    }
</script>

{#if chat.kind === "direct_chat"}
    {subtext}
{:else if chat.kind === "group_chat"}
    <div class="wrapper">
        <div class="visibility">
            <div class={`img ${chat.public ? "public" : "private"}`} />
            <div class="name">
                {chat.public ? $_("access.public") : $_("access.private")}
            </div>
        </div>
        <div class="members">
            <span class="num">{chat.memberCount.toLocaleString()}</span>
            {$_("members")}
        </div>
    </div>
{/if}

<style lang="scss">
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
