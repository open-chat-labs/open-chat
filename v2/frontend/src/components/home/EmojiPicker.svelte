<script lang="ts">
    import { onMount } from "svelte";

    import { NimblePicker } from "emoji-mart";
    import type { Data, BaseEmoji } from "emoji-mart";
    import React from "react";
    import { define } from "remount/es5";
    import data from "emoji-mart/data/all.json";
    import "emoji-mart/css/emoji-mart.css";
    import { emojiStore } from "../../stores/emoji";

    let wrapper: HTMLDivElement;

    onMount(() => {
        const Picker = () =>
            React.createElement(NimblePicker, {
                theme: "auto",
                data: data as unknown as Data,
                native: true,
                onSelect: (emoji) => {
                    emojiStore.set(emoji as BaseEmoji);
                },
                emoji: "point_up",
                title: "Emoji",
                showPreview: true,
                perLine: 3,
                style: {
                    width: "100%",
                    border: "none",
                    borderRadius: "0",
                    backgroundColor: "var(--entry-bg)",
                },
            });

        try {
            define({ "emoji-picker": Picker });
        } catch (err) {}

        const picker = document.createElement("emoji-picker");
        wrapper.appendChild(picker);
    });
</script>

<div bind:this={wrapper} />

<style type="text/scss">
    :global(.emoji-mart-preview) {
        display: none;
    }

    :global(.emoji-mart-bar) {
        border: none;
    }

    :global(#emoji-mart-search-1) {
        background-color: var(--entry-input-bg);
        color: var(--entry-input-txt);
        border: none;
    }

    :global(.emoji-mart-category-label span) {
        background-color: var(--entry-bg) !important;
        color: var(--entry-input-txt);
    }
</style>
