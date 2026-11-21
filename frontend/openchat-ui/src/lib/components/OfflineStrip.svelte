<!-- A slim full-width notice across the top of an app (the app being offline): the offline Banner's tone and icon, its text centred, wrapping to a second line rather than losing its end. Its height is the host's `--offline-strip` (0 closed), which the host sets on the root from `height` (the strip's height open) and keeps its frame clear of; registered here as a length, it opens and closes over 0.2s (none with reduced motion), the strip coming down from its top edge and the host's frame with it. The host positions it. Its `role="status"` text is always in the page, set only while `shown`, so screen readers hear it arrive. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** Whether it's saying it: the live region's text (the host opens it with `--offline-strip`). */
    shown: boolean;
    /** Resource key (or literal text). */
    text: string;
    /** Bindable: its height open, in CSS pixels, for the host's `--offline-strip`. */
    height?: number;
  }

  let { shown, text, height = $bindable(0) }: Props = $props();
  const t = useT();
</script>

<span class="live" role="status">{shown ? t(text) : ''}</span>

<div class="strip" aria-hidden="true">
  <div class="content" bind:offsetHeight={height}>
    <span class="icon"></span>
    <span class="text">{t(text)}</span>
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a length, so it can move: the strip and the host's frame open and close together
  @property --offline-strip {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }

  :global(html) {
    transition: --offline-strip 0.2s var(--ease-out);

    @include reduced-motion {
      transition: none;
    }
  }

  .live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .strip {
    height: var(--offline-strip, 0px);
    overflow: hidden;
    display: flex;
    // as it opens, it comes down from its top edge
    align-items: flex-end;
    // the offline tone's tint is see-through, so the page's surface goes under it
    background:
      linear-gradient(var(--status-chit-soft), var(--status-chit-soft)),
      var(--surface-1);
    box-shadow: inset 0 -1px 0 var(--status-chit-soft);
  }

  .content {
    flex: none;
    width: 100%;
    box-sizing: border-box;
    min-height: 28px;
    padding: 5px var(--space-16);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
  }

  .icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--status-chit);
    mask: var(--icon-offline) center/contain no-repeat;
  }

  .text {
    min-width: 0;
    font: var(--weight-medium) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink);
    text-align: center;
    text-wrap: balance;
  }
</style>
