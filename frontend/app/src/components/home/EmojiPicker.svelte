<script lang="ts">
    import "emoji-picker-element";
    import type {
        EmojiClickEvent,
        SkinTone,
        SkinToneChangeEvent,
    } from "emoji-picker-element/shared";
    import { emojiGroupNames, type CustomEmoji, type SelectedEmoji } from "openchat-client";
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    interface Props {
        mode?: "message" | "reaction" | "thread";
        onEmojiSelected: (emoji: SelectedEmoji) => void;
        onSkintoneChanged?: (tone: SkinTone) => void;
        customEmojis?: Map<string, CustomEmoji>;
    }

    let paid = new Set([2, 3]);

    let { mode = "message", onEmojiSelected, onSkintoneChanged, customEmojis }: Props = $props();

    function lockedCss(code: string) {
        return `
        .custom-emoji[id*="-${code}"] {
            filter: saturate(0.8);
            position: relative;
        }

        .custom-emoji[id*="-${code}"]::before {
            content: "";
            width: 16px;
            height: 16px;
            background-image: url(/assets/locked_solid.svg);
            background-repeat: no-repeat;
            position: absolute;
        }
        `;
    }

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

        // customEmojis?.entries().forEach(([_, emoji]) => {
        //     if (!paid.has(emoji.groupId)) {
        //         rules.push(lockedCss(emoji.code));
        //     }
        // });

        rules.push(lockedCategoryCss(0, 10_000));
        rules.push(lockedCategoryCss(1, 50_000));
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
                        category: emojiGroupNames[emoji.groupId],
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
                onEmojiSelected(custom);
            }
        }
    }
</script>

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
