<!-- Overlapping avatars. Up to `max` shown; past that, max-1 faces + a "+N" badge.
     people: [{ grad|color|src, initial?, name? }] or plain CSS background strings. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { cssUrl } from '../cssUrl';
  type Person = string | { grad?: string; color?: string; src?: string; initial?: string; name?: string };

  interface Props {
    people?: Person[];
    max?: number;
    size?: number;
    initials?: boolean;
    ring?: string;
  }

  let { people = [], max = 4, size = 28, initials = false, ring = 'var(--surface-2)' }: Props = $props();
  const t = useT();

  const faces = $derived(
    people.map((x) =>
      typeof x === 'string'
        ? { bg: x, initial: '' }
        : {
            bg: x.src ? `center/cover ${cssUrl(x.src)}` : x.grad || x.color || 'var(--surface-3,#24242e)',
            initial: initials ? x.initial || '' : '',
          },
    ),
  );
  const over = $derived(faces.length > max);
  const shown = $derived(over ? faces.slice(0, max - 1) : faces);
  const overlap = $derived(`${Math.round(size * 0.28)}px`);
</script>

<span
  class="stack"
  style:padding-left={overlap}
  style:--size="{size}px"
  style:--font-size="{Math.round(size * 0.4)}px"
  style:--overlap="-{overlap}"
  style:--ring={ring}
  role="img"
  aria-label={t('ui.avatarStack.people', { count: faces.length })}
>
  {#each shown as face}
    <span class="face" style:background={face.bg}>{face.initial}</span>
  {/each}
  {#if over}
    <span class="more">+{faces.length - shown.length}</span>
  {/if}
</span>

<style>
  .stack {
    display: inline-flex;
    align-items: center;
  }

  .face,
  .more {
    flex: none;
    height: var(--size);
    margin-left: var(--overlap);
    box-shadow: 0 0 0 2px var(--ring);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .face {
    width: var(--size);
    border-radius: 50%;
    font: 700 var(--font-size) / 1 var(--font-sans);
    color: #0e0e12;
  }

  .more {
    min-width: var(--size);
    box-sizing: border-box;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--surface-3, #24242e);
    font: 600 var(--font-size) / 1 var(--font-mono);
    color: var(--ink);
  }
</style>
