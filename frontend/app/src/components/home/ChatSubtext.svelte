<script lang="ts">
    import type { ChatSummary, OpenChat } from "@client";
    import { allUsersStore, directChatStatus, directChatSubtitle } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import Translatable from "@shared_components/Translatable.svelte";
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
    let them = $derived($allUsersStore.get(userId));
    let checkLastOnline = $derived(
        directChatStatus(them) === "last_online" && chat.kind === "direct_chat",
    );
    let lastOnline = $state<number>();
    let subtext = $derived(directChatSubtitle($_, them, $now, lastOnline).text);

    $effect(() => {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((at) => {
                lastOnline = at;
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
