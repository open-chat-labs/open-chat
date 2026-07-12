<script lang="ts">
    import { ColourVars, Column, MenuItem } from "component-lib";
    import { type EmojiSummary, type SelectedEmoji } from "@client";
    import { untrack } from "svelte";
    import { searchAllEmojis, summaryToSelectedEmoji } from "@src/utils/emojis";

    interface Props {
        query: string | undefined;
        offset: number;
        onSelect: (emoji: SelectedEmoji) => void;
        onClose: () => void;
    }

    let { query, offset, onSelect, onClose }: Props = $props();

    let index = $state(0);
    let matches: EmojiSummary[] = $state([]);

    // this is definitely a bit horrible. It seems to be necessary when we use the virtual list.
    const ITEM_HEIGHT = 43.2;
    $effect(() => {
        if (query !== undefined) {
            search(query);
        }
    });

    function search(query: string) {
        untrack(() => {
            searchAllEmojis(query).then((m) => {
                matches = m;
            });
        });
    }

    function select(match: EmojiSummary) {
        onSelect(summaryToSelectedEmoji(match));
    }

    function onKeyDown(ev: KeyboardEvent): void {
        switch (ev.key) {
            case "ArrowDown":
                index = (index + 1) % matches.length;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "ArrowUp":
                index = index === 0 ? matches.length - 1 : index - 1;
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Escape":
                onClose();
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Enter":
                const match = matches[index];
                if (match) {
                    select(match);
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
        }
    }
</script>

<div class="picker" style={`bottom: ${offset}px; height: ${matches.length * ITEM_HEIGHT}px`}>
    <Column backgroundColor={ColourVars.background1}>
        {#each matches as match, i}
            <MenuItem selected={i === index} onclick={() => select(match)}>
                {#snippet icon()}
                    <div class="emoji">
                        {#if match.kind === "native"}
                            {match.unicode}
                        {:else}
                            <img class="custom-emoji" src={match.url} alt={match.code} />
                        {/if}
                    </div>
                {/snippet}
                :{match.code}:
            </MenuItem>
        {/each}
    </Column>
</div>

<svelte:body onkeydown={onKeyDown} />

<style lang="scss">
    :global(.picker .menu) {
        box-shadow: none;
        position: relative;
        width: 100%;
        height: 100%;
        @include z-index("footer-overlay");
    }

    .picker {
        position: absolute;
        z-index: 10;
        width: 100%;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        left: 0;
    }
    .emoji {
        @include font(book, normal, fs-160);
        margin-right: $sp4;
    }

    .custom-emoji {
        width: 1em;
        height: 1em;
        object-fit: contain;
        vertical-align: middle;
    }
</style>
