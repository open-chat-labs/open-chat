<script lang="ts">
    import { Caption, ColourVars, IconButton, Row } from "component-lib";
    import {
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
    const searchBoxHeight: number = $state(80);
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
</script>

<svelte:window onkeydown={onWindowKeyDown} />

{#if showMentionPicker}
    <MentionPicker
        offset={searchBoxHeight}
        direction={"down"}
        prefix={mentionPrefix}
        mentionSelf
        usersOnly
        onMention={mention} />
{/if}

<Row gap={"sm"} crossAxisAlignment={"center"} padding={"md"}>
    <IconButton onclick={onClose}>
        {#snippet icon(color)}
            <Close {color} />
        {/snippet}
    </IconButton>
    <Row
        gap={"sm"}
        crossAxisAlignment={"center"}
        padding={["sm", "md"]}
        borderRadius={"circle"}
        backgroundColor={ColourVars.inputBackground}>
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
            <Caption width={"hug"} colour={"textSecondary"}>
                {count}
            </Caption>
        {/if}
    </Row>
    <IconButton onclick={onNext}>
        {#snippet icon(color)}
            <ChevronUp {color} />
        {/snippet}
    </IconButton>
    <IconButton onclick={onPrevious}>
        {#snippet icon(color)}
            <ChevronDown {color} />
        {/snippet}
    </IconButton>
</Row>

<style lang="scss">
    input {
        flex: 1;
        width: 100%;
        outline: none;
        border: none;
        color: var(--text-secondary);
        background-color: transparent;
        font-size: var(--typo-body-sz);
        line-height: var(--typo-body-lh);

        &::placeholder {
            color: var(--input-placeholder);
        }
    }

    .searching {
        @include loading-spinner(1em, 0.5em, var(--button-spinner));
        margin-right: 0.5rem;
    }
</style>
