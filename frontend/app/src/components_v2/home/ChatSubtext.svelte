<script lang="ts">
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import Translatable from "../Translatable.svelte";
    import DisappearLabel from "./DisappearLabel.svelte";
    import VisibilityLabel from "./VisibilityLabel.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
        clickableMembers?: boolean;
        onMembersClick?: () => void;
    }

    let { chat, clickableMembers = false, onMembersClick }: Props = $props();

    let userId = $derived(chat.kind === "direct_chat" ? chat.them.userId : "");
    let isBot = $derived($allUsersStore.get(userId)?.kind === "bot");
    let isSuspended = $derived($allUsersStore.get(userId)?.suspended ?? false);
    let subtext = $derived(isSuspended ? $_("accountSuspended") : "");
    let checkLastOnline = $derived(!isSuspended && !isBot && chat.kind === "direct_chat");

    $effect(() => {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((lastOnline) => {
                if (lastOnline !== undefined && lastOnline !== 0) {
                    [subtext] = client.formatLastOnlineDate($_, $now, lastOnline);
                } else {
                    subtext = "";
                }
            });
        }
    });

    function click() {
        if (clickableMembers) {
            onMembersClick?.();
        }
    }
</script>

{#if chat.kind === "direct_chat"}
    <div class="wrapper">
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        {subtext}
    </div>
{:else if chat.kind === "group_chat" || chat.kind === "channel"}
    <div class="wrapper">
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        <VisibilityLabel isPublic={chat.public} />
        <div class="members" class:clickable={clickableMembers} onclick={click}>
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
