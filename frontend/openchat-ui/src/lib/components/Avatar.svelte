<!-- Gradient avatar placeholder with an optional online dot. shape: circle | squircle (radius = a third of the size).
     url: an image (an uploaded avatar) over the gradient, which shows while it loads and if it fails to.
     suspended: the face dimmed, with a red ban mark where the online dot sits (and no online dot). -->
<script lang="ts" module>
  /** The avatar swatches' gradients, for a host drawing a face the same colour elsewhere (a picker's tile). */
  export const AVATAR_GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    blue: 'linear-gradient(140deg,#3d7bff,#7a3dff)',
    teal: 'linear-gradient(140deg,#2ee6a8,#1f8fbf)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff5f4d)',
    plum: 'linear-gradient(140deg,#b04dff,#4d2dff)',
  };
</script>

<script lang="ts">
  interface Props {
    size?: number;
    shape?: 'circle' | 'squircle';
    color?: keyof typeof AVATAR_GRADIENTS;
    online?: boolean;
    /** An image over the gradient (an uploaded avatar); the gradient shows while it loads and if it fails to. */
    url?: string;
    /** A suspended account: the face dimmed and a red ban mark in the online dot's place; no online dot. */
    suspended?: boolean;
  }

  let { size = 42, shape = 'circle', color = 'violet', online = false, url, suspended = false }: Props = $props();

  const big = $derived(size >= 60);
  // the image that failed to load: a new url is tried
  let failed = $state<string>();
  const image = $derived(url && url !== failed ? url : undefined);
</script>

<div class="avatar" style:width="{size}px" style:height="{size}px">
  <div
    class="face"
    class:dimmed={suspended}
    style:border-radius={shape === 'circle' ? '999px' : `${Math.round(size * 0.33)}px`}
    style:background={AVATAR_GRADIENTS[color] ?? AVATAR_GRADIENTS.violet}
  >
    {#if image}
      <img class="image" src={image} alt="" loading="lazy" draggable="false" onerror={() => (failed = image)} />
    {/if}
    {#if online && !suspended}
      <span class="dot" class:big></span>
    {/if}
  </div>
  <!-- outside the face, so the dimming leaves it at full strength -->
  {#if suspended}
    <span class="ban" class:big aria-hidden="true"><span class="ban-icon"></span></span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .avatar {
    position: relative;
    display: inline-flex;
    flex: none;
  }

  .face {
    position: relative;
    flex: none;
    width: 100%;
    height: 100%;
    @include flex-center;
  }

  .image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    object-fit: cover;
  }

  // TODO(design): the suspended look (the dimming, the mark) isn't in the design export
  .dimmed {
    opacity: 0.45;
  }

  .ban {
    position: absolute;
    bottom: -1px;
    inset-inline-end: -1px;
    width: 15px;
    height: 15px;
    border-radius: var(--radius-pill);
    background: var(--card);
    @include flex-center;

    &.big {
      bottom: 1px;
      inset-inline-end: 1px;
      width: 19px;
      height: 19px;

      .ban-icon {
        width: 15px;
        height: 15px;
      }
    }
  }

  .ban-icon {
    @include icon(ban, 12px, var(--status-danger));
  }

  .dot {
    position: absolute;
    bottom: 0;
    inset-inline-end: 0;
    width: 11px;
    height: 11px;
    border-radius: var(--radius-pill);
    background: var(--status-online);
    box-shadow: 0 0 0 3px var(--card);

    &.big {
      bottom: 2px;
      inset-inline-end: 2px;
      width: 14px;
      height: 14px;
    }
  }
</style>
