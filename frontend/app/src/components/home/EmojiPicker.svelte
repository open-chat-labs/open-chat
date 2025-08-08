<script lang="ts">
    import "emoji-picker-element";
    import type {
        EmojiClickEvent,
        SkinTone,
        SkinToneChangeEvent,
    } from "emoji-picker-element/shared";
    import {
        emojiGroupNames,
        PremiumItem,
        premiumItemsStore,
        premiumPrices,
        type CustomEmoji,
        type SelectedEmoji,
    } from "openchat-client";
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";
    import PremiumItemPayment from "../PremiumItemPayment.svelte";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        onEmojiSelected: (emoji: SelectedEmoji) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
        customEmojis?: Map<string, CustomEmoji>;
    }

    let { mode = "message", onEmojiSelected, onSkintoneChanged, customEmojis }: Props = $props();
    let showPayGate = $state<CustomEmoji>();

    function lockedCategoryCss(groupId: number, price: number) {
        return `
            .category:not(.gone)#menu-label-${groupId} {
                position: relative;
            }

            .category:not(.gone)#menu-label-${groupId}::after {
                content: "(${price.toLocaleString()} CHIT)";
                font-size: 10px;
                height: 14px;
                background-image: url(/assets/locked_solid.svg);
                background-repeat: no-repeat;
                position: absolute;
                margin-left: 5px;
                padding-left: 18px;
                padding-top: 2px;
                color: var(--txt-light);
                vertical-align: middle;
                top: 8px;
            }

            .category:not(.gone)#menu-label-${groupId} + .emoji-menu[aria-labelledby="menu-label-${groupId}"] {
                opacity: 0.5;
            }
        `;
    }

    function createCustomCss(): string {
        const rules: string[] = [];
        if (!$premiumItemsStore.has(PremiumItem.BotEmojis)) {
            rules.push(lockedCategoryCss(0, premiumPrices[PremiumItem.BotEmojis]));
        }
        if (!$premiumItemsStore.has(PremiumItem.PopularEmojis)) {
            rules.push(lockedCategoryCss(1, premiumPrices[PremiumItem.PopularEmojis]));
        }
        return rules.join("\n");
    }

    onMount(() => {
        const emojiPicker = document.querySelector("emoji-picker");

        if (emojiPicker && customEmojis) {
            emojiPicker.customEmoji = [
                ...customEmojis.entries().map(([_, emoji]) => {
                    return {
                        name: emoji.code,
                        shortcodes: [emoji.code],
                        url: emoji.url,
                        category: emojiGroupNames[emoji.premiumItem],
                    };
                }),
            ];
        }
        emojiPicker?.addEventListener("emoji-click", onClick);
        emojiPicker?.addEventListener("skin-tone-change", skinToneChanged);

        const style = document.createElement("style");
        style.textContent = createCustomCss();
        emojiPicker?.shadowRoot?.appendChild(style);

        return () => {
            emojiPicker?.removeEventListener("emoji-click", onClick);
        };
    });

    function skinToneChanged(ev: SkinToneChangeEvent) {
        onSkintoneChanged?.(ev.detail.skinTone);
    }

    function onClick(ev: EmojiClickEvent) {
        if (ev.detail.unicode) {
            onEmojiSelected({ kind: "native", unicode: ev.detail.unicode });
        } else if (ev.detail.name !== undefined) {
            const custom = customEmojis?.get(ev.detail.name);
            if (custom !== undefined) {
                if (!$premiumItemsStore.has(custom.premiumItem)) {
                    showPayGate = custom;
                } else {
                    onEmojiSelected(custom);
                }
            }
        }
    }

    function paidForItem() {
        if (showPayGate) {
            onEmojiSelected(showPayGate);
            showPayGate = undefined;
        }
    }
</script>

{#if showPayGate}
    <PremiumItemPayment
        item={showPayGate.premiumItem}
        onSuccess={paidForItem}
        onCancel={() => (showPayGate = undefined)}></PremiumItemPayment>
{/if}

<emoji-picker
    class:message={mode === "message"}
    class:reaction={mode === "reaction"}
    class:thread={mode === "thread"}
    class:dark={$currentTheme.mode === "dark"}
    class:light={$currentTheme.mode === "light"}></emoji-picker>

<style lang="scss">
    :global(.emoji-overlay .modal-content) {
        background-color: var(--menu-bg);
    }

    emoji-picker {
        width: 100%;
        --emoji-padding: 0.3rem;
        --emoji-size: 1.8rem;
        --background: transparent;

        --border-size: 0;
        --border-color: var(--bd);
        --input-font-color: var(--txt);
        --input-border-color: var(--bd);
        --input-padding: 8px 16px;

        --num-columns: 12 !important;

        @include size-below(sm) {
            --num-columns: 11 !important;
        }
        @include size-below(xs) {
            --num-columns: 9 !important;
        }
        @include size-below(xxs) {
            --num-columns: 7 !important;
        }

        &.thread {
            --num-columns: 10 !important;
        }
    }
</style>
