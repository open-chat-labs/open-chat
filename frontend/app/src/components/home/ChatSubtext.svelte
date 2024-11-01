<script lang="ts">
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { userStore } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { now } from "../../stores/time";
    import VisibilityLabel from "./VisibilityLabel.svelte";
    import DisappearLabel from "./DisappearLabel.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;
    export let clickableMembers = false;

    $: userId = chat.kind === "direct_chat" ? chat.them.userId : "";
    $: isBot = $userStore.get(userId)?.kind === "bot";
    $: isSuspended = $userStore.get(userId)?.suspended ?? false;
    $: subtext = isSuspended ? $_("accountSuspended") : "";
    $: checkLastOnline = !isSuspended && !isBot && chat.kind === "direct_chat";

    $: {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((lastOnline) => {
                if (lastOnline !== undefined && lastOnline !== 0) {
                    [subtext] = client.formatLastOnlineDate($_, $now, lastOnline);
                } else {
                    subtext = "";
                }
            });
        }
    }

    function onMembersClick() {
        if (clickableMembers) {
            dispatch("membersClick");
        }
    }
</script>

{#if chat.kind === "direct_chat"}
    {subtext}
{:else if chat.kind === "group_chat" || chat.kind === "channel"}
    <div class="wrapper">
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        <VisibilityLabel isPublic={chat.public} />
        <div class="members" class:clickable={clickableMembers} on:click={onMembersClick}>
            <span class="num">{chat.memberCount.toLocaleString()}</span>
            <Translatable resourceKey={i18nKey("members")} />
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

    .members {
        .num {
            color: var(--txt);
            font-weight: 700;
        }
    }

    .clickable {
        cursor: pointer;
    }
</style>
