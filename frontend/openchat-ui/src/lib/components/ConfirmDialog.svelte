<!-- Asks before something that can't be taken back or that others depend on: what will happen, the facts it acts on
     (label · value, the value in mono), and the action in the danger colour beside Cancel. With `confirmWord` the
     action stays off until that word (a report number, say) is typed, for what destroys something. On DialogShell:
     Esc, the backdrop and × cancel. Text is resource keys or literal text. -->
<script lang="ts">
  import { useT } from '../i18n';
  import Button from './Button.svelte';
  import DialogShell from './DialogShell.svelte';
  import TextInput from './TextInput.svelte';

  interface Props {
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text): what will happen. */
    body: string;
    /** What it acts on: labels are resource keys or literal text, values literal. */
    facts?: { label: string; value: string }[];
    /** Literal text to type before the action is on. */
    confirmWord?: string;
    /** Resource key (or literal text). */
    confirmLabel: string;
    /** The action is under way: it spins, and nothing can be pressed. */
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }

  let { title, body, facts = [], confirmWord, confirmLabel, busy = false, onConfirm, onClose }: Props = $props();
  const t = useT();

  let typed = $state('');
  const ready = $derived(confirmWord === undefined || typed.trim() === confirmWord);
</script>

<DialogShell {title} width={460} height="auto" onClose={busy ? undefined : onClose}>
  <div class="confirm">
    <p class="body">{t(body)}</p>
    {#if facts.length > 0}
      <dl class="facts">
        {#each facts as fact (fact.label)}
          <div><dt>{t(fact.label)}</dt><dd>{fact.value}</dd></div>
        {/each}
      </dl>
    {/if}
    {#if confirmWord !== undefined}
      <TextInput
        label={t('ui.confirmDialog.typeToConfirm', { word: confirmWord })}
        value={typed}
        mono
        onInput={(v) => (typed = v)} />
    {/if}
    <div class="actions">
      <Button label="ui.common.cancel" variant="secondary" disabled={busy} onClick={onClose} />
      <Button label={confirmLabel} variant="danger" {busy} disabled={!ready || busy} onClick={onConfirm} />
    </div>
  </div>
</DialogShell>

<style lang="scss">
  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
  }

  .body {
    margin: 0;
    font: var(--weight-regular) var(--text-base) / 1.55 var(--font-sans);
    color: var(--ink-2);
    text-wrap: pretty;
  }

  .facts {
    margin: 0;
    border-radius: var(--radius-md);
    background: var(--overlay-1);
    overflow: hidden;

    div {
      display: flex;
      justify-content: space-between;
      gap: var(--space-12);
      padding: var(--space-10) var(--space-12);
    }

    div + div {
      box-shadow: inset 0 1px 0 var(--line-1);
    }
  }

  dt {
    font: var(--weight-medium) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink-3);
  }

  dd {
    margin: 0;
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-mono);
    color: var(--ink);
    text-align: end;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
  }
</style>
