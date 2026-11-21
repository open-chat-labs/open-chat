<!-- A piece of text still loading (a user's name): Skeleton's shimmer as a short bar on the text's line, in its place.
     The bar is aria-hidden; the text reads `label` ("Loading…") instead. Sits in a flex line or inline. -->
<script lang="ts">
  import { useT } from '../i18n';

  interface Props {
    /** The bar's width, about the text's (a name's, by default); it shrinks with its line, down to 48px. */
    width?: string;
    /** Resource key (or literal text) read in the text's place. */
    label?: string;
  }

  let { width = '132px', label = 'ui.common.loading' }: Props = $props();
  const t = useT();
</script>

<span class="skeleton-text" style:--skeleton-text-width={width}
  ><span class="bar" aria-hidden="true"></span><span class="label">{t(label)}</span></span
>

<style lang="scss">
  // on the text's line height, so its line doesn't move as the text comes in
  .skeleton-text {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex: 0 1 var(--skeleton-text-width);
    width: var(--skeleton-text-width);
    min-width: 48px;
    max-width: 100%;
    height: 1.2em;
    vertical-align: middle;
  }

  // Skeleton's first line: tokens --skeleton-base / --skeleton-sheen, keyframes oc-shimmer (stopped under reduced
  // motion by tokens.css)
  .bar {
    width: 100%;
    height: 11px;
    border-radius: 6px;
    background: var(--skeleton-base);
    background-image: var(--skeleton-sheen);
    background-size: 200% 100%;
    animation: oc-shimmer 1.4s ease-in-out infinite;
  }

  .label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
