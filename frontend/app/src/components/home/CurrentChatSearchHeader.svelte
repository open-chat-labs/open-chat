<script lang="ts">
    import {
        iconSize,
        type ChatSummary,
        type OpenChat,
        type UserOrUserGroup,
    } from "@client";
    import { ChatSearch } from "@src/logic/conversation/chatSearch.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import MentionPicker from "./MentionPicker.svelte";

    interface Props {
        chat: ChatSummary;
        searchTerm?: string;
        onClose: () => void;
        onGoToMessageIndex: (args: { index: number; preserveFocus: boolean }) => void;
    }

    let { chat, searchTerm = $bindable(""), onClose, onGoToMessageIndex }: Props = $props();

    const client = getContext<OpenChat>("client");
    const mentionRegex = /@(\w*)$/;

    let inputElement: HTMLInputElement | undefined = $state();
    let showMentionPicker = $state(false);
    let mentionPrefix: string | undefined = $state();
    let searchBoxHeight: number = $state(80);
    let rangeToReplace: [number, number] | undefined = undefined;

    let isGroup = $derived(chat.kind === "group_chat" || chat.kind === "channel");

    // the chat's matches, newest first, and the one shown (logic/conversation/chatSearch)
    const search = new ChatSearch({
        search: async (term, mentions) => {
            const response = await client.searchChat(chat.id, term, mentions, 200);
            return response.kind === "success" ? response.matches : undefined;
        },
        get group() {
            return isGroup;
        },
        lookup: (name) => {
            const userOrGroup = client.lookupUserForMention(name, true);
            return userOrGroup === undefined
                ? undefined
                : (client.userOrUserGroupId(userOrGroup) ?? "");
        },
        onGoTo: (index) => onGoToMessageIndex({ index, preserveFocus: index >= 0 }),
    });
    let count = $derived(
        search.matches.length > 0 ? `${search.current + 1}/${search.matches.length}` : "",
    );

    onMount(() => {
        inputElement?.focus();
        if (searchTerm.length > 0) {
            performSearch();
        }
        return () => search.dispose();
    });

    // up is older, down newer: round past the ends
    function onNext() {
        search.older(true);
    }

    function onPrevious() {
        search.newer(true);
    }

    function performSearch() {
        void search.search(searchTerm);
    }

    function onKeyPress(e: KeyboardEvent) {
        if (e.key === "Enter") {
            performSearch();
            e.preventDefault();
        }
    }

    function onInput() {
        triggerMentionLookup();
    }

    function onInputKeyup() {
        if (showMentionPicker) {
            return;
        }
        search.typed(searchTerm);
    }

    function triggerMentionLookup() {
        if (!isGroup) {
            return;
        }

        const pos = inputElement?.selectionEnd ?? 0;
        const slice = inputElement?.value?.slice(0, pos);
        const matches = slice?.match(mentionRegex);

        if (matches != null) {
            if (matches.index !== undefined) {
                rangeToReplace = [matches.index, pos];
                mentionPrefix = matches[1].toLowerCase() || undefined;
                showMentionPicker = true;
            }
        } else {
            showMentionPicker = false;
            mentionPrefix = undefined;
        }
    }

    function onWindowKeyDown(event: KeyboardEvent) {
        if (event.code === "ArrowDown") {
            onPrevious();
        } else if (
            event.code === "ArrowUp" ||
            (event.code === "Enter" && search.searched(searchTerm))
        ) {
            onNext();
        } else if (event.code === "Escape") {
            onClose();
        } else {
            return;
        }

        if (search.matches.length > 0) {
            event.preventDefault();
        }
    }

    function setCaretToEnd() {
        inputElement?.setSelectionRange(searchTerm.length, searchTerm.length);
    }

    function replaceTextWith(replacement: string) {
        if (rangeToReplace === undefined) return;

        inputElement?.setRangeText(replacement, rangeToReplace[0], rangeToReplace[1], "end");
        inputElement?.focus();
        searchTerm = inputElement?.value ?? "";
    }

    function mention(userOrGroup: UserOrUserGroup): void {
        const username = client.userOrUserGroupName(userOrGroup);
        const userLabel = `@${username}`;

        replaceTextWith(userLabel);

        showMentionPicker = false;
        performSearch();
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }
</script>

<svelte:window onkeydown={onWindowKeyDown} />

{#if showMentionPicker}
    <MentionPicker
        offset={searchBoxHeight}
        direction={"down"}
        prefix={mentionPrefix}
        mentionSelf
        usersOnly
        onClose={cancelMention}
        onMention={mention} />
{/if}

<SectionHeader shadow flush entry bind:height={searchBoxHeight}>
    <div onclick={onClose}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div class="wrapper">
        <input
            bind:this={inputElement}
            oninput={onInput}
            onkeyup={onInputKeyup}
            onkeypress={onKeyPress}
            spellcheck="false"
            bind:value={searchTerm}
            type="text"
            maxlength="30"
            placeholder={$_("search")} />
        {#if search.searching}
            <div class="searching"></div>
        {:else}
            <div class="count">{count}</div>
        {/if}
    </div>
    <div onclick={onNext}>
        <HoverIcon compact>
            <ChevronUp size="1.8em" color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div onclick={onPrevious}>
        <HoverIcon compact>
            <ChevronDown size="1.8em" color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
</SectionHeader>

<style lang="scss">
    .wrapper {
        width: 100%;
        margin: 0 5px;
        flex: 1;
        display: flex;
        gap: 4px;
        @include input();
        background-color: var(--chatSearch-bg);
        box-shadow: var(--chatSearch-sh);
        border: var(--bw) solid var(--chatSearch-bd);
        border-radius: var(--chatSearch-rd);
    }

    input {
        flex: 1;
        width: 100%;
        outline: none;
        border: none;
        @include font(book, normal, fs-100);
        color: var(--txt);
        background-color: transparent;

        &::placeholder {
            color: var(--placeholder);
        }
    }

    .searching {
        @include loading-spinner(1em, 0.5em, var(--button-spinner));
        margin-right: 8px;
    }

    .count {
        @include font(light, normal, fs-70);
        color: var(--txt);
        align-self: center;
    }
</style>
