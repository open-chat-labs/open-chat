<script lang="ts">
    import MenuItem from "../MenuItem.svelte";
    import Menu from "../Menu.svelte";
    import VirtualList from "../VirtualList.svelte";
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import { emojiDatabase } from "../../utils/emojis";
    import type { NativeEmoji } from "emoji-picker-element/shared";
    import { mobileWidth } from "stores/screenDimensions";

    type EmojiSummary = {
        unicode: string;
        code: string;
    };

    export let query: string | undefined;
    export let offset: number;

    let index = 0;
    let matches: EmojiSummary[] = [];

    // this is definitely a bit horrible. It seems to be necessary when we use the virtual list.
    $: ITEM_HEIGHT = $mobileWidth ? 43.2 : 49.59;
    $: {
        if (query !== undefined) {
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
        }
    }

    const dispatch = createEventDispatcher();

    function select(emoji: string) {
        dispatch("select", emoji);
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
                dispatch("close");
                ev.preventDefault();
                ev.stopPropagation();
                break;
            case "Enter":
                const match = matches[index];
                if (match) {
                    select(match.unicode);
                }
                ev.preventDefault();
                ev.stopPropagation();
                break;
        }
    }
</script>

<div class="picker" style={`bottom: ${offset}px; height: ${matches.length * ITEM_HEIGHT}px`}>
    <Menu>
        <VirtualList keyFn={(e) => e.unicode} items={matches} let:item let:itemIndex>
            <MenuItem selected={itemIndex === index} on:click={() => select(item.unicode)}>
                <div class="emoji" slot="icon">
                    {item.unicode}
                </div>
                <div slot="text">
                    :{item.code}:
                </div>
            </MenuItem>
        </VirtualList>
    </Menu>
</div>

<svelte:body on:keydown={onKeyDown} />

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
