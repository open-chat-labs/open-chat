<!-- One glyph from the canonical set (lib/icons.js → lib/styles/icons.css). Colour follows currentColor unless set.
     flip mirrors direction-bearing glyphs in RTL. label makes it announced; otherwise it is decorative. -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    icon: string;
    size?: number | string;
    color?: string;
    flip?: boolean;
    /** Accessible name: resource key (or literal text). Without it the icon is decorative. */
    label?: string;
  }

  let { icon, size = 16, color = 'currentColor', flip = false, label }: Props = $props();
  const t = useT();

  const px = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<span
  class="icon"
  style:width={px}
  style:height={px}
  style:background={color}
  style:mask="var(--icon-{icon}) center/contain no-repeat"
  role={label ? 'img' : undefined}
  aria-label={label ? t(label) : undefined}
  aria-hidden={label ? undefined : 'true'}
  data-oc-flip={flip ? '' : undefined}
></span>

<style>
  .icon {
    flex: none;
    display: inline-block;
    vertical-align: middle;
  }
</style>
