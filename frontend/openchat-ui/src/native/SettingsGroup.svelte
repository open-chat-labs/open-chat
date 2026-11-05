<!-- A settings card (native design notes §1 Spacing, §3.11): an optional section label (4px in), the rows on
     --overlay-1 with a 16px radius and full-width 1px dividers between them, and an optional note under it. The rows
     are the Settings* components (SettingsSwitch, SettingsValue, SettingsLink, SettingsCopy, SettingsSegmented,
     SettingsSwatches, SettingsMeter, SettingsAction); each carries its own 16px padding. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../lib/i18n';
  import ListSectionLabel from '../lib/components/ListSectionLabel.svelte';

  interface Props {
    /** Resource key (or literal text): the section label above the card. */
    label?: string;
    /** Resource key (or literal text): a note under the card. */
    note?: string;
    /** The rows. */
    children: Snippet;
  }

  let { label = '', note = '', children }: Props = $props();
  const t = useT();
</script>

<section class="group">
  {#if label}<div class="label"><ListSectionLabel {label} /></div>{/if}
  <div class="card">{@render children()}</div>
  {#if note}<p class="note">{t(note)}</p>{/if}
</section>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .group {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label {
    padding-inline-start: 4px;
  }

  .card {
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    background: var(--overlay-1);
    overflow: hidden;

    // full-width dividers between rows (each row's root carries .settings-row)
    :global(.settings-row ~ .settings-row) {
      box-shadow: inset 0 1px 0 var(--line-1);
    }
  }

  .note {
    margin: 0;
    padding: 0 4px;
    font: var(--weight-regular) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }
</style>
