<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../SectionHeader.svelte";
    import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import type { MessageMatch, ChatSummary } from "openchat-client";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { OpenChat } from "openchat-client";
    import MentionPicker from "./MentionPicker.svelte";

    export let chat: ChatSummary;
    export let searchTerm = "";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");
    const reverseUserLookup: Record<string, string> = {};
    const mentionRegex = /@([\d\w_]*)$/;

    let lastSearchTerm = "";
    let matches: MessageMatch[] = [];
    let currentMatch = 0;
    let inputElement: HTMLInputElement;
    let searching = false;
    let showMentionPicker = false;
    let mentionPrefix: string | undefined;
    let searchBoxHeight: number | undefined;
    let rangeToReplace: [number, number] | undefined = undefined;
    let timer: number | undefined;

    $: userStore = client.userStore;
    $: count = matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "";
    $: isGroup = chat.kind === "group_chat";
    $: members = client.currentChatMembers;
    $: blockedUsers = client.currentChatBlockedUsers;

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
        if (lastSearchTerm === searchTerm) {
            return;
        }

        clearMatches();
        const [term, mentions] = extractMentions(searchTerm);
        if (term.length > 2 || mentions.length > 0) {
            lastSearchTerm = searchTerm;
            searching = true;
            const lowercase = term.toLowerCase();
            try {
                let response = await client.searchChat(chat.chatId, lowercase, mentions, 50);
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

    function extractMentions(text: string): [string, string[]] {
        if (!isGroup) {
            return [text, []];
        }

        let mentionedSet = new Set<string>();
        let expandedText = text.replace(/@([\w\d_]*)/g, (match, p1) => {
            const userId = reverseUserLookup[p1];
            if (userId !== undefined) {
                mentionedSet.add(userId);
                return "";
            } else {
                console.log(
                    `Could not find the userId for user: ${p1}, this should not really happen`
                );
            }
            return match;
        });

        return [expandedText, Array.from(mentionedSet)];
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

    function onKeyPress(e: KeyboardEvent) {
        if (e.key === "Enter") {
            if (timer !== undefined) {
                window.clearTimeout(timer);
            }
            performSearch();
            e.preventDefault();
        }
    }

    function onInput() {
        triggerMentionLookup();
    }

    function onInputKeyup() {
        if (showMentionPicker || lastSearchTerm === searchTerm) {
            return;
        }
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            performSearch();
        }, 300);
    }

    function triggerMentionLookup() {
        if (!isGroup) {
            return;
        }

        const pos = inputElement.selectionEnd ?? 0;
        const slice = inputElement.value.slice(0, pos);
        const matches = slice.match(mentionRegex);

        if (matches !== null) {
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
            (event.code === "Enter" && lastSearchTerm === searchTerm)
        ) {
            onNext();
        } else if (event.code === "Escape") {
            onClose();
        } else {
            return;
        }

        if (matches.length > 0) {
            event.preventDefault();
        }
    }

    function setCaretToEnd() {
        inputElement.setSelectionRange(searchTerm.length, searchTerm.length);
    }

    function replaceTextWith(replacement: string) {
        if (rangeToReplace === undefined) return;

        inputElement.setRangeText(replacement, rangeToReplace[0], rangeToReplace[1], "end");
        inputElement.focus();
        searchTerm = inputElement.value;
    }

    function mention(ev: CustomEvent<string>): void {
        const user = $userStore[ev.detail];
        const username = user?.username ?? $_("unknown");
        const userLabel = `@${username}`;

        replaceTextWith(userLabel);

        showMentionPicker = false;
        if (user !== undefined) {
            reverseUserLookup[username] = user.userId;
        }
        performSearch();
    }

    function cancelMention() {
        showMentionPicker = false;
        setCaretToEnd();
    }
</script>

<svelte:window on:keydown={onWindowKeyDown} />

{#if showMentionPicker}
    <MentionPicker
        offset={searchBoxHeight ?? 80}
        direction={"down"}
        mentionSelf
        prefix={mentionPrefix}
        members={$members}
        blockedUsers={$blockedUsers}
        on:close={cancelMention}
        on:mention={mention} />
{/if}

<SectionHeader shadow flush entry bind:height={searchBoxHeight}>
    <div on:click={onClose}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </div>
    <div class="wrapper">
        <input
            bind:this={inputElement}
            on:input={onInput}
            on:keyup={onInputKeyup}
            on:keypress={onKeyPress}
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

<style lang="scss">
    .wrapper {
        border-radius: 18px;
        padding: $sp3 $sp4;
        background-color: var(--chatSearch-bg);
        box-shadow: var(--chatSearch-sh);
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
