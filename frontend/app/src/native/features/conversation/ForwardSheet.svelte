<!-- Forwarding a message (native design notes §3.3): a sheet of one fixed height with the message
     it forwards, a search of the chats it can go to (those the user can send text in, less this
     one: `chatsToShareTo`, as every tree's picker), rows to pick several from, an optional note,
     and "Forward to 3 chats". Picking doesn't open the chats: the host forwards to all of them
     (`forwardMessageToChats`) and says how it went. -->
<script lang="ts">
    import {
        allUsersStore,
        communitiesStore,
        favouritesStore,
        groupMembersLine,
        serverDirectChatsStore,
        serverGroupChatsStore,
        type ChatIdentifier,
        type Message,
        type OpenChat,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { chatsToShareTo } from "@src/logic/share/chatsToShareTo";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { forwardRows } from "./forward.adapter";
    import { ForwardPicks } from "./forwardPicks.svelte";

    type Props = {
        /** The message to forward; none: the sheet is closed. */
        message: Message | undefined;
        /** The chat it's in, not offered. */
        from: ChatIdentifier | undefined;
        onClose: () => void;
        /** Forward to these chats, with the note (empty for none); the sheet asks to close next. */
        onForward: (chatIds: ChatIdentifier[], note: string) => void;
    };

    let { message, from, onClose, onForward }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the search, what's picked and the note: each time the sheet opens, afresh
    const picks = new ForwardPicks<Message>();
    $effect.pre(() => {
        const shown = message;
        untrack(() => picks.show(shown));
    });

    const preview = $derived(
        message === undefined ? "" : client.getContentAsText($_, message.content),
    );

    const rows = $derived(
        forwardRows(
            chatsToShareTo(
                client,
                {
                    directChats: $serverDirectChatsStore.values(),
                    groupChats: $serverGroupChatsStore.values(),
                    communities: $communitiesStore.values(),
                    favourites: $favouritesStore,
                    users: $allUsersStore,
                },
                from,
                picks.query,
            ),
            {
                favourites: $_("communities.favourites"),
                directChats: $_("communities.directChats"),
                groupChats: $_("communities.groupChats"),
            },
            (chat) =>
                chat.kind === "direct_chat"
                    ? ""
                    : chat.description || interpolate($_, groupMembersLine(chat)),
        ),
    );

    function forward() {
        const picked = picks.picked();
        if (picked === undefined) return;
        onForward(picked.chatIds, picked.note);
        onClose();
    }
</script>

<BottomSheet
    open={message !== undefined}
    {onClose}
    title={$_("native.conversation.forward.title")}
    height="86%"
    keyboard={softKeyboard.covering}>
    <div class="top">
        <div class="item">
            <span class="item-icon"></span>
            <span class="item-text">{preview}</span>
        </div>
        <Field
            placeholder={$_("native.conversation.forward.search")}
            value={picks.query}
            onInput={(e) => (picks.query = e.currentTarget.value)}
            onClear={() => (picks.query = "")}
            showShortcut={false} />
    </div>
    <div class="list" role="listbox" aria-multiselectable="true">
        {#each rows as row, i (`${row.section}:${row.id}`)}
            {#if row.section !== rows[i - 1]?.section}
                <span class="section">{row.section}</span>
            {/if}
            {@const on = picks.isPicked(row.id)}
            <button
                type="button"
                class="row"
                class:on
                role="option"
                aria-selected={on}
                onclick={() => picks.toggle(row.id, row.chatId)}>
                <Avatar size={40} color={row.color} shape={row.round ? "circle" : "squircle"} />
                <span class="text">
                    <span class="name">{row.name}</span>
                    {#if row.sub}<span class="sub">{row.sub}</span>{/if}
                </span>
                <span class="check" aria-hidden="true"></span>
            </button>
        {:else}
            <p class="none">
                {picks.query.trim() === ""
                    ? $_("native.conversation.forward.noChats")
                    : $_("native.conversation.forward.noMatches", {
                          values: { query: picks.query },
                      })}
            </p>
        {/each}
    </div>
    <div class="foot">
        <input
            class="note"
            type="text"
            value={picks.note}
            oninput={(e) => (picks.note = e.currentTarget.value)}
            placeholder={$_("native.conversation.forward.note")}
            aria-label={$_("native.conversation.forward.note")} />
        <Button
            label={picks.count === 0
                ? $_("native.conversation.forward.pick")
                : $_("native.conversation.forward.send", { values: { count: picks.count } })}
            size="lg"
            fullWidth
            disabled={picks.count === 0}
            onClick={forward} />
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

    // what's forwarded: the message as text, two lines at most
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
        background: var(--overlay-2);
        position: relative;

        &::after {
            content: "";
            position: absolute;
            inset: 0;
            margin: auto;
            width: 16px;
            height: 16px;
            mask: var(--icon-forward) center/contain no-repeat;
            background: var(--ink-2);
        }
    }

    .item-text {
        min-width: 0;
        font: var(--weight-medium) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-2);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        overflow-wrap: anywhere;
    }

    // the rows scroll under the search, 6px apart (notes §1 Spacing)
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-4) var(--space-16) var(--space-16);
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

        &.on {
            background: color-mix(in oklch, var(--accent) 14%, transparent);
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

    // a ring, filled with a tick once picked
    .check {
        flex: none;
        width: 24px;
        height: 24px;
        box-sizing: border-box;
        border-radius: var(--radius-circle);
        border: 2px solid var(--overlay-3);
        position: relative;

        .on & {
            border: 0;
            background: var(--accent);

            &::after {
                content: "";
                position: absolute;
                inset: 0;
                margin: auto;
                width: 14px;
                height: 14px;
                mask: var(--icon-check) center/contain no-repeat;
                background: var(--on-accent);
            }
        }
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    // the note and the button, pinned under the list
    .foot {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-10);
        padding: var(--space-10) var(--space-16) var(--space-12);
        box-shadow: inset 0 1px 0 var(--line-1);
    }

    .note {
        box-sizing: border-box;
        width: 100%;
        min-height: 46px;
        padding: 0 var(--space-16);
        border: 0;
        border-radius: 14px;
        background: var(--field);
        color: var(--ink);
        font: var(--weight-regular) text-size(15px) / 1.3 var(--font-sans);
        outline: none;

        &::placeholder {
            color: var(--ink-4);
        }

        &:focus-visible {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }
</style>
