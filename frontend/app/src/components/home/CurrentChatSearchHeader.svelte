<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../SectionHeader.svelte";
    import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type {
        MessageMatch,
        SearchDirectChatResponse,
        SearchGroupChatResponse,
        ChatSummary,
    } from "openchat-client";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { OpenChat } from "openchat-client";

    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;
    export let searchTerm = "";

    const client = getContext<OpenChat>("client");

    let lastSearchTerm = "";
    let timer: number | undefined;
    let matches: MessageMatch[] = [];
    let currentMatch = 0;
    let inputElement: HTMLInputElement;
    let searching = false;

    $: count = matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "";

    onMount(() => {
        inputElement.focus();
        if (searchTerm.length > 0) {
            performSearch();
        }
        return () => clearMatches();
    });

    function onClose() {
        dispatch("close");
    }

    function onNext() {
        currentMatch++;
        gotoMatch();
    }

    function onPrevious() {
        currentMatch--;
        gotoMatch();
    }

    function gotoMatch() {
        if (matches.length === 0) return;

        if (currentMatch < 0) {
            currentMatch = matches.length - 1;
        }

        if (currentMatch >= matches.length) {
            currentMatch = 0;
        }

        dispatch("goToMessageIndex", {
            index: matches[currentMatch].messageIndex,
            preserveFocus: true,
        });
    }

    function clearMatches() {
        matches = [];
        dispatch("goToMessageIndex", {
            index: -1,
            preserveFocus: false,
        });
    }

    async function performSearch() {
        clearMatches();
        if (searchTerm.length > 2) {
            lastSearchTerm = searchTerm;
            searching = true;
            const lowercase = searchTerm.toLowerCase();
            try {
                let response = await client.searchChat(chat, lowercase, 50);
                if (response.kind === "success") {
                    matches = filterAndSortMatches(response.matches);
                    if (matches.length > 0) {
                        currentMatch = 0;
                        gotoMatch();
                    }
                }
            } catch (_err) {
            } finally {
                searching = false;
            }
        }
    }

    function filterAndSortMatches(matches: MessageMatch[]): MessageMatch[] {
        const topScore = matches[0].score;
        const keepThreshold = topScore * 0.2;
        console.log(
            `all matches: ${matches.length}, topScore: ${topScore}, bottomScore: ${
                matches[matches.length - 1].score
            }`
        );
        matches = matches
            // Only show matches > than 20% of the top scoring match
            .filter((m) => m.score >= keepThreshold)
            // Sort matches in reverse chronological order
            .sort((m1, m2) => m2.messageIndex - m1.messageIndex);
        return matches;
    }

    function onInputKeyup() {
        if (lastSearchTerm === searchTerm) {
            return;
        }
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length > 2) {
                performSearch();
            }
        }, 300);
    }

    function onWindowKeyDown(event: KeyboardEvent) {
        if (event.code === "ArrowDown") {
            onPrevious();
        } else if (event.code === "ArrowUp" || event.code === "Enter") {
            onNext();
        } else if (event.code === "Escape") {
            onClose();
        }
    }
</script>

<svelte:window on:keydown={onWindowKeyDown} />

<SectionHeader shadow={true} flush={true} entry={true}>
    <div on:click={onClose}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div class="wrapper">
        <input
            bind:this={inputElement}
            on:keyup={onInputKeyup}
            spellcheck="false"
            bind:value={searchTerm}
            type="text"
            maxlength="30"
            placeholder={$_("search")} />
        {#if searching}
            <div class="searching" />
        {:else}
            <div class="count">{count}</div>
        {/if}
    </div>
    <div on:click={onNext}>
        <HoverIcon compact={true}>
            <ChevronUp size="1.8em" color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div on:click={onPrevious}>
        <HoverIcon compact={true}>
            <ChevronDown size="1.8em" color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
</SectionHeader>

<style type="text/scss">
    .wrapper {
        border-radius: 18px;
        padding: 5px 12px 5px 12px;
        background-color: var(--chatSearch-bg);
        width: 100%;
        margin: 0 5px;
        flex: 1;
        display: flex;
        gap: 4px;

        @include mobile() {
            border-radius: $sp4;
        }
    }

    input {
        flex: 1;
        width: 100%;
        outline: none;
        border: none;
        @include font(book, normal, fs-100);
        color: var(--chatSearch-txt);
        background-color: inherit;

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
        color: var(--chatSearch-txt);
        align-self: center;
    }
</style>
