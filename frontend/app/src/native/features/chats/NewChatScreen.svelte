<!-- New chat (native design notes §3.2), pushed from the Chats tab's FAB: a search for people by name
     or @username, New group, and the people the user chats with most (Frequently contacted), or an
     empty state without any. Picking someone opens the chat with them in this screen's place. -->
<script lang="ts">
    import {
        allUsersStore,
        chatListScopeStore,
        chatSummariesListStore,
        currentUserIdStore,
        directChatUsers,
        serverDirectChatsStore,
        type OpenChat,
        type UserSummary,
    } from "@client";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { SEARCH_INPUT_ATTRIBUTES } from "@openchat/ui/src/lib/searchInput";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { chatWithRoute } from "@src/logic/appEvents/appEvents";
    import { searchTerm } from "@src/logic/chats/chatSearch";
    import { PeopleSearch } from "@src/logic/chats/peopleSearch.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onDestroy } from "svelte";
    import { _ } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { personResult } from "./chats.adapter";
    import ResultRow from "./ResultRow.svelte";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "new_chat" }>> = $props();

    const client = getContext<OpenChat>("client");

    // as many as components_mobile's New message shows
    const FREQUENT = 30;

    let query = $state("");
    const term = $derived(searchTerm(query));

    const people = new PeopleSearch((t) => client.searchUsers(t, 20));
    onDestroy(() => people.dispose());

    function onInput(next: string) {
        query = next;
        people.set(searchTerm(next));
    }

    // the people the user has DMs with, the latest first (directChatUsers: no bots, nobody deleted)
    const frequent = $derived(
        directChatUsers($serverDirectChatsStore, $allUsersStore).slice(0, FREQUENT),
    );

    const found = $derived.by((): UserSummary[] | undefined => {
        const results = people.results;
        if (results.kind !== "found" || results.term !== term) return undefined;
        return results.people.filter((user) => user.userId !== $currentUserIdStore);
    });

    const shown = $derived(term === "" ? frequent : (found ?? []));
    const rows = $derived(shown.map((user) => personResult(user, client.displayName(user), term)));

    function pick(userId: string) {
        // the chat takes this screen's place in the stack (TabStacks). The URL is still the list's,
        // so the route's scope is the list's
        const chatId = { kind: "direct_chat", userId } as const;
        navigate(chatWithRoute(chatId, $chatSummariesListStore, $chatListScopeStore));
    }
</script>

<div class="new-chat">
    <NativePageHeader title={$_("newChat")} onBack={context.back} />

    <div class="field">
        <!-- a search, not a sign-in field: password managers leave it alone -->
        <input
            {...SEARCH_INPUT_ATTRIBUTES}
            value={query}
            oninput={(e) => onInput(e.currentTarget.value)}
            placeholder={$_("native.chats.newChat.placeholder")}
            aria-label={$_("native.chats.newChat.placeholder")} />
    </div>

    <div class="list">
        <button type="button" class="new-group" onclick={() => context.push({ kind: "new_group" })}>
            <span class="new-group-icon"></span>
            <span class="new-group-label">{$_("newGroup")}</span>
        </button>

        {#if rows.length > 0}
            <span class="label">
                {$_(term === "" ? "native.chats.newChat.frequent" : "native.chats.newChat.results")}
            </span>
            {#each rows as row (row.id)}
                <ResultRow {row} onSelect={() => pick(row.id)} />
            {/each}
        {:else if term !== "" && found === undefined}
            <div class="searching"><Spinner /></div>
        {:else if term !== ""}
            <span class="none">{$_("native.chats.newChat.noOne")}</span>
        {:else}
            <div class="empty">
                <span class="empty-tile"><span class="empty-icon"></span></span>
                <span class="empty-title">{$_("native.chats.newChat.noContacts")}</span>
                <span class="empty-body">{$_("native.chats.newChat.noContactsBody")}</span>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .new-chat {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .field {
        flex: none;
        padding: var(--space-6) var(--space-16) var(--space-10);
    }

    input {
        box-sizing: border-box;
        width: 100%;
        height: 48px;
        padding: 0 var(--space-16);
        border: 0;
        outline: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        font: var(--weight-medium) text-size(15px) / 1 var(--font-sans);
        appearance: none;

        &::placeholder {
            color: var(--ink-4);
        }

        // type="search"'s own clear button: the screen has none (the plan draws none)
        &::-webkit-search-cancel-button,
        &::-webkit-search-decoration {
            display: none;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    // picker rows, 6px apart (notes §1 Spacing), clear of the home indicator at the end
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-8) var(--scroll-end);
    }

    .new-group {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-12);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .new-group-icon {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        background: var(--accent-soft);
        @include flex-center;

        &::after {
            content: "";
            @include icon(users, 18px, var(--accent));
        }
    }

    .new-group-label {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
    }

    .label {
        padding: var(--space-16) var(--space-12) 0;
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .searching {
        display: grid;
        place-items: center;
        padding: var(--space-32);
    }

    .none {
        padding: var(--space-32) var(--space-16);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
        padding: 56px var(--space-24) 0;
        text-align: center;
    }

    .empty-tile {
        width: 72px;
        height: 72px;
        border-radius: var(--radius-circle);
        background: var(--overlay-1);
        @include flex-center;
    }

    .empty-icon {
        @include icon(users, 30px, var(--ink-3));
    }

    .empty-title {
        font: var(--weight-bold) var(--text-xl) / 1.25 var(--font-sans);
    }

    .empty-body {
        max-width: 280px;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>
