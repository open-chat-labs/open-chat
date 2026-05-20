<script lang="ts">
    import VirtualList from "@shared_components/VirtualList.svelte";
    import { mobileWidth, type EmojiSummary, type SelectedEmoji } from "openchat-client";
    import { untrack } from "svelte";
    import { searchAllEmojis, summaryToSelectedEmoji } from "../../utils/emojis";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";

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
    let ITEM_HEIGHT = $derived($mobileWidth ? 43.2 : 49.59);
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
    <Menu>
        <VirtualList keyFn={(e) => e.code} items={matches}>
            {#snippet children(match, itemIndex)}
                <MenuItem selected={itemIndex === index} onclick={() => select(match)}>
                    {#snippet icon()}
                        <div class="emoji">
                            {#if match.kind === "native"}
                                {match.unicode}
                            {:else}
                                <img class="custom-emoji" src={match.url} alt={match.code} />
                            {/if}
                        </div>
                    {/snippet}
                    {#snippet text()}
                        <div>
                            :{match.code}:
                        </div>
                    {/snippet}
                </MenuItem>
            {/snippet}
        </VirtualList>
    </Menu>
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
        width: 100%;
        max-height: calc(var(--vh, 1vh) * 50);
        overflow: auto;
        box-shadow: var(--menu-inverted-sh);
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
