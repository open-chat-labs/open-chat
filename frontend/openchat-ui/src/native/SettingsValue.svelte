<!-- Settings row for a value picked from a few (native design notes §1 Structure 4: the anchored menu): the label,
     the current value and a chevron down; a tap opens an AnchoredMenu of the options from the row, the current one
     ticked. -->
<script lang="ts">
  import AnchoredMenu from './AnchoredMenu.svelte';
  import SettingsLink from './SettingsLink.svelte';
  import type { NativeMenuItem } from './types';

  interface Props {
    /** Resource key (or literal text). */
    label: string;
    /** Resource key (or literal text). */
    help?: string;
    /** The options: ids and labels (resource keys or literal text). */
    options: { id: string; label: string }[];
    /** The current option's id. */
    value: string;
    onChange: (id: string) => void;
  }

  let { label, help = '', options, value, onChange }: Props = $props();

  let anchor = $state<HTMLElement | null>(null);
  const current = $derived(options.find((o) => o.id === value)?.label ?? '');
  const items = $derived<NativeMenuItem[]>(options.map((o) => ({ id: o.id, label: o.label, selected: o.id === value })));
</script>

<SettingsLink {label} {help} value={current} chevron="down" onClick={(row) => (anchor = row)} />
<AnchoredMenu {anchor} {items} {label} onSelect={onChange} onClose={() => (anchor = null)} />
