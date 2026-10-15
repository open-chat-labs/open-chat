<!-- Renders the text for a resource key through the host's translator (setI18n) — just the text, no element of its
     own, so it inherits whatever it's placed in. Props that take copy (Button label …) accept a key directly; use this
     for copy in your own markup.
     Placeholders that need markup are passed as snippets named after them; the sentence stays one message:
       <Translate key="ui.leaveGroupDialog.question" params={{ noun }}>
         {#snippet name()}<strong>{groupName}</strong>{/snippet}
       </Translate> -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { segments, useT, type I18nParams } from '../i18n';

  interface Props {
    /** Resource key, e.g. 'ui.common.cancel'. Text that isn't a key renders as itself. */
    key: string;
    /** Values for plain `{placeholder}`s in the message. */
    params?: I18nParams;
    /** Snippets for placeholders rendered as markup, by placeholder name. */
    [slot: string]: unknown;
  }

  let { key, params, ...rest }: Props = $props();
  const t = useT();

  const slots = $derived(Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v === 'function')) as Record<string, Snippet>);
  const parts = $derived(segments(t, key, Object.keys(slots), params));
</script>

{#each parts as part}{#if 'slot' in part}{@render slots[part.slot]()}{:else}{part.text}{/if}{/each}
