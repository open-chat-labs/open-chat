<script lang="ts">
    import { ColourVars, Column, MenuItem } from "component-lib";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import { mobileWidth } from "openchat-client";
    import { untrack } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";

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
    let ITEM_HEIGHT = $derived($mobileWidth ? 43.2 : 49.59);
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
    <Column backgroundColor={ColourVars.background1}>
        {#each matches as match, i}
            <MenuItem selected={i === index} onclick={() => select(match.unicode)}>
                {#snippet icon()}
                    <div class="emoji">
                        {match.unicode}
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
    }
    .emoji {
        @include font(book, normal, fs-160);
        margin-right: $sp4;
    }
</style>
