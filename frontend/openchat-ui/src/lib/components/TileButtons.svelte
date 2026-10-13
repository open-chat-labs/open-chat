<!-- Row of square icon+label actions under a panel header (video, mute, search …). A tile with `on` is a live toggle:
     it shows its state rather than committing anything, so it reads accent-tinted when engaged. -->
<script lang="ts">
  const MASKS: Record<string, string> = {
    video: 'var(--icon-video) center/contain no-repeat',
    mute: 'var(--icon-bell-off) center/contain no-repeat',
    search: 'var(--icon-search) center/contain no-repeat',
    members: 'var(--icon-users) center/contain no-repeat',
    everyone: 'var(--icon-community) center/contain no-repeat',
    everyoneOff: 'var(--icon-everyone-off) center/contain no-repeat',
    muteOff: 'var(--icon-mute-off) center/contain no-repeat',
    pin: 'var(--icon-pin) center/contain no-repeat',
  };

  const LABELS: Record<string, string> = { video: 'Video call', mute: 'Mute', search: 'Search', members: 'Members', pin: 'Pinned', everyone: '@everyone' };

  type TileKey = 'video' | 'mute' | 'search' | 'members' | 'everyone' | 'pin';

  interface Tile {
    icon: TileKey;
    label?: string;
    on?: boolean;
  }

  interface Props {
    tiles: (TileKey | Tile)[];
    /** Click handler per tile icon key. */
    handlers?: Partial<Record<TileKey, () => void>>;
    /** Grid columns; 0 = one per tile. */
    columns?: number;
  }

  let { tiles, handlers = {}, columns = 0 }: Props = $props();

  const items = $derived(
    tiles.map((tile) => {
      const o: Tile = typeof tile === 'object' ? tile : { icon: tile };
      const on = !!o.on;
      return {
        on,
        mask: MASKS[on && MASKS[o.icon + 'On'] ? o.icon + 'On' : o.icon] || MASKS.search,
        label: o.label || LABELS[o.icon] || o.icon,
        onPress: handlers[o.icon],
      };
    }),
  );
</script>

<div class="tiles" style:grid-template-columns="repeat({columns || tiles.length},minmax(0,1fr))">
  {#each items as tile}
    <div class="tile" class:on={tile.on} onclick={tile.onPress} role="button" tabindex="0">
      <span class="icon" style:mask={tile.mask}></span>
      <span class="label">{tile.label}</span>
    </div>
  {/each}
</div>

<style>
  .tiles {
    display: grid;
    gap: var(--space-6);
    width: 100%;
  }

  .tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: var(--space-16) 0;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    cursor: pointer;
    user-select: none;
  }

  .tile.on {
    background: color-mix(in srgb, var(--accent, #ff5672) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent, #ff5672) 38%, transparent);
  }

  .tile:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .icon {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #d8d8e2);
  }

  .label {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    color: var(--ink-2, #b9b9c6);
    white-space: nowrap;
  }

  .on .icon {
    background: var(--accent-bright, #ff8298);
  }

  .on .label {
    color: var(--accent-bright, #ff8298);
  }
</style>
