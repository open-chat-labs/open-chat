<!-- The tiles under a chat's name (native plan 10: a DM's Call / Search / Mute, a group's Mute /
     Search / Invite): square icon + label buttons on --overlay-1, side by side, a toggle that's on
     tinted in the accent (as the library's TileButtons, the web panel's, here with touch's press
     rather than hover). -->
<script lang="ts">
    import type { DetailTile, DetailTileId } from "./details.adapter";

    type Props = { tiles: DetailTile[]; onTile: (id: DetailTileId) => void };

    let { tiles, onTile }: Props = $props();
</script>

<div class="tiles" style:grid-template-columns="repeat({tiles.length}, minmax(0, 1fr))">
    {#each tiles as tile (tile.id)}
        <button
            type="button"
            class="tile"
            class:on={tile.on}
            aria-pressed={tile.id === "mute" ? tile.on : undefined}
            onclick={() => onTile(tile.id)}>
            <span class="icon" style:mask="var(--icon-{tile.icon}) center/contain no-repeat"></span>
            <span class="label">{tile.label}</span>
        </button>
    {/each}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .tiles {
        display: grid;
        gap: var(--space-8);
    }

    .tile {
        min-width: 0;
        min-height: 68px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: var(--space-12) var(--space-4);
        border: 0;
        border-radius: 16px;
        background: var(--overlay-1);
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }

        &:focus-visible {
            @include focus-ring;
        }

        &.on {
            background: color-mix(in srgb, var(--accent) 14%, transparent);
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 38%, transparent);
            color: var(--accent-bright);
        }
    }

    .icon {
        width: 20px;
        height: 20px;
        background: currentColor;
    }

    .label {
        max-width: 100%;
        font: var(--weight-semibold) text-size(12.5px) / 1.1 var(--font-sans);
        @include truncate;
    }
</style>
