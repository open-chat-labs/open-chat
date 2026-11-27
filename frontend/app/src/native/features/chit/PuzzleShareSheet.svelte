<!-- Share to chat, from a solved puzzle (native plan 14): a sheet of the chats the user can send
     text in (`chatsToShareTo`, as the forward sheet and the web's picker list them, the sections
     theirs: forward.adapter) with a search. Tapping one picks it: the host takes the result into that
     chat's draft and opens it, nothing sent until the user sends it (as the web's share). -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        favouritesStore,
        groupMembersLine,
        serverDirectChatsStore,
        serverGroupChatsStore,
        type ChatIdentifier,
        type OpenChat,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import { chatsToShareTo } from "@src/logic/share/chatsToShareTo";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { forwardRows } from "../conversation/forward.adapter";

    type Props = {
        open: boolean;
        /** What's shared, as the picker names it (shareItem): the puzzle, then its game and time. */
        item: { title: string; sub: string } | undefined;
        onClose: () => void;
        onPick: (chatId: ChatIdentifier) => void;
    };

    let { open, item, onClose, onPick }: Props = $props();

    const client = getContext<OpenChat>("client");

    let query = $state("");

    const rows = $derived(
        open
            ? forwardRows(
                  chatsToShareTo(
                      client,
                      {
                          directChats: $serverDirectChatsStore.values(),
                          groupChats: $serverGroupChatsStore.values(),
                          communities: $communitiesStore.values(),
                          favourites: $favouritesStore,
                          users: $allUsersStore,
                      },
                      undefined,
                      query,
                  ),
                  {
                      favourites: $_("communities.favourites"),
                      directChats: $_("communities.directChats"),
                      groupChats: $_("communities.groupChats"),
                  },
                  (chat) =>
                      chat.kind === "direct_chat"
                          ? ""
                          : chat.description || interpolateNewUi($_, groupMembersLine(chat)),
              )
            : [],
    );
</script>

<BottomSheet
    {open}
    {onClose}
    title={$_("native.chit.shareToChat")}
    height="86%"
    keyboard={softKeyboard.covering}>
    <div class="top">
        {#if item !== undefined}
            <div class="item">
                <span class="item-icon"></span>
                <span class="item-text">
                    <span class="item-title">{item.title}</span>
                    <span class="item-sub">{item.sub}</span>
                </span>
            </div>
        {/if}
        <Field
            placeholder={$_("native.conversation.forward.search")}
            value={query}
            onInput={(e) => (query = e.currentTarget.value)}
            onClear={() => (query = "")}
            showShortcut={false} />
    </div>
    <div class="list" role="listbox">
        {#each rows as row, i (`${row.section}:${row.id}`)}
            {#if row.section !== rows[i - 1]?.section}
                <span class="section">{row.section}</span>
            {/if}
            <button
                type="button"
                class="row"
                role="option"
                aria-selected="false"
                onclick={() => onPick(row.chatId)}>
                <Avatar size={40} color={row.color} shape={row.round ? "circle" : "squircle"} />
                <span class="text">
                    <span class="name">{row.name}</span>
                    {#if row.sub}<span class="sub">{row.sub}</span>{/if}
                </span>
            </button>
        {:else}
            <p class="none">
                {query.trim() === ""
                    ? $_("native.conversation.forward.noChats")
                    : $_("native.conversation.forward.noMatches", { values: { query } })}
            </p>
        {/each}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .top {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-4) var(--space-16) var(--space-10);
    }

    .item {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-10) var(--space-12);
        border-radius: 14px;
        background: var(--overlay-1);
    }

    .item-icon {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-circle);
        background: color-mix(in oklch, var(--status-chit) 20%, transparent);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: 18px;
            height: 18px;
            mask: var(--icon-trophy) center/contain no-repeat;
            background: var(--status-chit);
        }
    }

    .item-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .item-title {
        font: var(--weight-semibold) text-size(14.5px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .item-sub {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-4) var(--space-16) var(--bar-end);
    }

    .section {
        padding: var(--space-16) var(--space-4) var(--space-2);
        font: var(--weight-semibold) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        text-transform: uppercase;
        letter-spacing: 0.04em;

        &:first-child {
            padding-top: var(--space-8);
        }
    }

    .row {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 62px;
        padding: 0 var(--space-12);
        border: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .name {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>
