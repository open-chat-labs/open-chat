<!-- One call participant. The feed keeps its own shape (ratio, default 4:3) and letterboxes inside the tile — never cropped.
     Avatar shows while the camera is off / no feed. speaking → accent ring (drawn above the feed). Name pill + mic state bottom-left. -->
<script lang="ts">
  interface Props {
    nameLabel: string;
    /** Avatar letter; defaults to the name's first letter. */
    initial?: string;
    /** Avatar background. */
    grad?: string;
    /** Feed background (placeholder for the video). */
    feed?: string;
    /** Feed aspect ratio, width / height. */
    ratio?: number;
    muted?: boolean;
    speaking?: boolean;
    /** Lead tile: larger avatar. */
    big?: boolean;
    /** Corner radius, px. */
    radius?: number;
  }

  let {
    nameLabel,
    initial,
    grad = 'linear-gradient(140deg,#B48CFF,#6A5CFF)',
    feed = 'linear-gradient(165deg,#4a3b45,#1d1a22)',
    ratio = 4 / 3,
    muted = false,
    speaking = false,
    big = false,
    radius = 10,
  }: Props = $props();
</script>

<div class="tile" style:border-radius="{radius}px" role="img" aria-label="{nameLabel}{muted ? ', muted' : ''}{speaking ? ', speaking' : ''}">
  <span class="ring" class:speaking aria-hidden="true"></span>
  <div class="feed" style:--ratio={ratio || 4 / 3} style:background={feed}>
    <span class="avatar" class:big style:background={grad}>{initial ?? nameLabel.slice(0, 1).toUpperCase()}</span>
  </div>
  <span class="name"
    ><span class="mic" class:muted style:mask="var(--icon-{muted ? 'mic-off' : 'mic'}) center/contain no-repeat"></span><span class="label">{nameLabel}</span></span
  >
</div>

<style>
  .tile {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: #121217;
    container-type: size;
    isolation: isolate;
  }

  .ring {
    position: absolute;
    inset: 0;
    z-index: 3;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    transition: box-shadow 200ms;
    pointer-events: none;
  }

  .ring.speaking {
    box-shadow: inset 0 0 0 2px var(--accent, #ff5672);
  }

  .feed {
    position: absolute;
    inset: 0;
    margin: auto;
    width: min(100%, calc(100cqh * var(--ratio)));
    height: min(100%, calc(100cqw / var(--ratio)));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 700 22px/1 var(--font-sans);
    color: #0e0e12;
  }

  .avatar.big {
    width: 112px;
    height: 112px;
    font-size: 40px;
  }

  .name {
    position: absolute;
    inset-inline-start: 8px;
    bottom: 8px;
    max-width: calc(100% - 16px);
    height: 24px;
    padding: 0 9px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.55);
    font: 600 12px/1 var(--font-sans);
    white-space: nowrap;
    overflow: hidden;
  }

  .mic {
    flex: none;
    width: 12px;
    height: 12px;
    background: #fff;
  }

  .mic.muted {
    background: var(--status-danger, #f5493d);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
