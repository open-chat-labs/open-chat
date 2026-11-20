<!-- Visual spec for the app-wide tooltip (behaviour: lib/behaviours/tooltip.js — any element with a title gets it).
     Plain label only: inverted surface, 12px semibold, above the target (flips below near the top edge).
     By hand (2026-11-19): `detail`, a second line under the label (a deleted message's "Today at 14:32"), and `id`, for
     the target's aria-describedby (ChatBubble's deleted placeholder shows it as its popover). -->
<script lang="ts">
  import { useT } from '../i18n';
  interface Props {
    /** Resource key (or literal text). */
    label: string;
    placement?: 'top' | 'bottom';
    /** Resource key (or literal text): a second line under the label. */
    detail?: string;
    /** The tooltip's id, for its target's aria-describedby. */
    id?: string;
  }

  let { label, placement = 'top', detail = '', id }: Props = $props();
  const t = useT();
</script>

<div class="tooltip" class:below={placement !== 'top'}>
  <span role="tooltip" {id}>{#if label}{t(label)}{/if}{#if label && detail}<br />{/if}{#if detail}<span class="detail">{t(detail)}</span>{/if}</span>
</div>

<style lang="scss">
  .tooltip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }

  .below {
    flex-direction: column-reverse;
  }

  span[role='tooltip'] {
    max-width: 240px;
    padding: 6px 9px;
    border-radius: 7px;
    background: var(--ink);
    color: var(--surface-1);
    font: 600 12px/1.3 var(--font-sans);
    text-wrap: balance;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  }

  .detail {
    font-weight: 500;
    opacity: 0.72;
  }
</style>
