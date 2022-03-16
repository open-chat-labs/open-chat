<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../SectionHeader.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import type { ChatSummary } from "../../domain/chat/chat";
    import type {
        MessageMatch,
        SearchDirectChatResponse,
        SearchGroupChatResponse,
    } from "../../domain/search/search";
    import { apiKey } from "../../services/serviceContainer";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import HoverIcon from "../HoverIcon.svelte";
    import { rtlStore } from "../../stores/rtl";
    import { iconSize } from "../../stores/iconSize";

    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;

    const api = getContext<ServiceContainer>(apiKey);

    let searching: boolean = false;
    let searchTerm = "";
    let timer: number | undefined;
    let matches: MessageMatch[];
    let currentMatch = 0;
    let inputElement: HTMLInputElement;

    onMount(() => {
        inputElement.focus();
        return () => {
            dispatch("goToMessageIndex", {
                index: -1,
                keep: false,
            });
        };
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
        currentMatch = Math.max(0, Math.min(matches.length - 1, currentMatch));

        dispatch("goToMessageIndex", {
            index: matches[currentMatch].messageIndex,
            keep: true,
        });
    }

    async function performSearch() {
        if (searchTerm.length > 2) {
            searching = true;
            const lowercase = searchTerm.toLowerCase();
            try {
                let response: SearchDirectChatResponse | SearchGroupChatResponse;
                if (chat.kind === "group_chat") {
                    response = await api.searchGroupChat(chat.chatId, lowercase, 50);
                } else {
                    response = await api.searchDirectChat(chat.chatId, lowercase, 50);
                }
                if (response.kind === "success") {
                    matches = response.matches.sort((a, b) => {
                        return b.messageIndex - a.messageIndex;
                    });
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

    function keydown() {
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length > 1) {
                performSearch();
            } else {
                if (searchTerm.length === 0) {
                    performSearch();
                }
            }
        }, 300);
    }
</script>

<SectionHeader shadow={true} flush={true}>
    <div on:click={onClose}>
        <HoverIcon>
            {#if $rtlStore}
                <ArrowRight size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </div>
    <input
        bind:this={inputElement}
        on:keydown={keydown}
        spellcheck="false"
        bind:value={searchTerm}
        type="text"
        maxlength="30"
        placeholder={$_("search")} />
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
    input {
        margin: 0 5px;
        background-color: var(--chatSearch-bg);
        color: var(--chatSearch-txt);
        outline: none;
        flex: 1;
        padding: $sp1 $sp3;
        border: none;
        border-bottom: 1px solid var(--accent);
        width: 100%;
        @include font(book, normal, fs-100);

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>
