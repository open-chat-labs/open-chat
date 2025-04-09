<script lang="ts">
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import { ui } from "openchat-client";
    import { untrack } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";
    import Menu from "../Menu.svelte";
    import MenuItem from "../MenuItem.svelte";
    import VirtualList from "../VirtualList.svelte";

    type EmojiSummary = {
        unicode: string;
        code: string;
    };

    interface Props {
        query: string | undefined;
        offset: number;
        onSelect: (emoji: string) => void;
        onClose: () => void;
    }

    let { query, offset, onSelect, onClose }: Props = $props();

    let index = $state(0);
    let matches: EmojiSummary[] = $state([]);

    // this is definitely a bit horrible. It seems to be necessary when we use the virtual list.
    let ITEM_HEIGHT = $derived(ui.mobileWidth ? 43.2 : 49.59);
    $effect(() => {
        if (query !== undefined) {
            search(query);
        }
    });

    function search(query: string) {
        untrack(() => {
            emojiDatabase.getPreferredSkinTone().then((tone) => {
                emojiDatabase.getEmojiBySearchQuery(query!).then((m) => {
                    matches = (m as NativeEmoji[])
                        .filter((m) => m.version < 14)
                        .map((match) => {
                            const unicode =
                                match.skins?.find((s) => s.tone === tone)?.unicode ?? match.unicode;
                            return {
                                unicode,
                                code: match.shortcodes
                                    ? match.shortcodes[match.shortcodes.length - 1]
                                    : match.annotation,
                            };
                        });
                });
            });
        });
    }

    function select(emoji: string) {
        onSelect(emoji);
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
                    select(match.unicode);
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                break;
        }
    }
</script>

<div class="picker" style={`bottom: ${offset}px; height: ${matches.length * ITEM_HEIGHT}px`}>
    <Menu>
        <VirtualList keyFn={(e) => e.unicode} items={matches}>
            {#snippet children(match, itemIndex)}
                <MenuItem selected={itemIndex === index} onclick={() => select(match.unicode)}>
                    {#snippet icon()}
                        <div class="emoji">
                            {match.unicode}
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
    }
    .emoji {
        @include font(book, normal, fs-160);
        margin-right: $sp4;
    }
</style>
