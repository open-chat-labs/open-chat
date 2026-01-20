<script lang="ts">
    import { Caption, ColourVars, IconButton, Row } from "component-lib";
    import {
        type ChatSummary,
        type MessageMatch,
        type OpenChat,
        type UserOrUserGroup,
    } from "openchat-client";
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

    let lastSearchTerm = "";
    let matches: MessageMatch[] = $state([]);
    let currentMatch = $state(0);
    let inputElement: HTMLInputElement | undefined = $state();
    let searching = $state(false);
    let showMentionPicker = $state(false);
    let mentionPrefix: string | undefined = $state();
    let searchBoxHeight: number = $state(80);
    let rangeToReplace: [number, number] | undefined = undefined;
    let timer: number | undefined;

    let count = $derived(matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "");
    let isGroup = $derived(chat.kind === "group_chat" || chat.kind === "channel");

    onMount(() => {
        inputElement?.focus();
        if (searchTerm.length > 0) {
            performSearch();
        }
        return () => clearMatches();
    });

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

        onGoToMessageIndex({
            index: matches[currentMatch].messageIndex,
            preserveFocus: true,
        });
    }

    function clearMatches() {
        matches = [];
        onGoToMessageIndex({
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
                let response = await client.searchChat(chat.id, lowercase, mentions, 200);
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
        let expandedText = text.replace(/@(\w*)/g, (match, p1) => {
            const userOrGroup = client.lookupUserForMention(p1, true);
            if (userOrGroup !== undefined) {
                mentionedSet.add(client.userOrUserGroupId(userOrGroup) ?? "");
                return "";
            } else {
                return match;
            }
        });

        return [expandedText, Array.from(mentionedSet)];
    }

    function filterAndSortMatches(matches: MessageMatch[]): MessageMatch[] {
        if (matches.length === 0) return matches;
        const topScore = matches[0].score;
        const keepThreshold = topScore * 0.2;
        console.log(
            `all matches: ${matches.length}, topScore: ${topScore}, bottomScore: ${
                matches[matches.length - 1].score
            }`,
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
        backgroundColor={ColourVars.textTertiary}>
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
        {#if searching}
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
            color: var(--text-placeholder);
        }
    }

    .searching {
        @include loading-spinner(1em, 0.5em, var(--button-spinner));
        margin-right: 0.5rem;
    }
</style>
