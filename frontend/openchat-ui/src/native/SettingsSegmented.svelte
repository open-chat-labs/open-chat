<!-- Settings row with a segmented choice (Appearance's Mode, Chat text size): the label over the compact (40px)
     SegmentedTabs. -->
<script lang="ts">
  import { useT } from '../lib/i18n';
  import SegmentedTabs from '../lib/components/SegmentedTabs.svelte';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** The choices: resource keys (or literal text). */
    options: string[];
    selected: number;
    onSelect: (i: number) => void;
  }

  let { label, options, selected, onSelect }: Props = $props();
  const t = useT();
</script>

<div class="settings-row segmented-row" role="group" aria-label={t(label)}>
  <span class="label">{t(label)}</span>
  <SegmentedTabs size="sm" labels={options} selectedIndex={selected} dotOnLast={false} {onSelect} />
</div>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .segmented-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
  }

  .label {
    font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    color: var(--ink);
  }
</style>
