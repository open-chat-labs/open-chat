<!-- A search result or a person to start a chat with (native design notes §1 Spacing, picker rows):
     a 40px avatar, the name with what matched in accent, and the line under it; 60px tall, 14px
     radius. -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import type { ResultRow } from "./chats.adapter";

    let { row, onSelect }: { row: ResultRow; onSelect: () => void } = $props();
</script>

<button type="button" class="row" onclick={onSelect}>
    <Avatar size={40} shape={row.kind === "group" ? "squircle" : "circle"} color={row.color} />
    <span class="text">
        <span class="title"
            >{row.kind === "channel" ? "#" : ""}{row.title.before}<span class="match"
                >{row.title.match}</span
            >{row.title.after}</span>
        {#if row.sub}<span class="sub">{row.sub}</span>{/if}
    </span>
</button>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .row {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        width: 100%;
        min-height: 60px;
        padding: var(--space-8) var(--space-10);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .title {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .match {
        color: var(--accent-bright);
    }

    .sub {
        font: var(--weight-regular) text-size(13.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }
</style>
