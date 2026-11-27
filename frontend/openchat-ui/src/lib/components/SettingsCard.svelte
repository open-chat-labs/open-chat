<!-- One settings form as a card: an icon tile, the title and a line of help, then the fields (children, in one or two
     columns), and a footer with how the last attempt went on the left and the form's buttons (actions) on the right.
     A form that's a single switch puts it at the end of the title line (aside) and needs no button: the footer shows
     only once there's an outcome. `dual`: the fields are CompareRows, under Current and Proposed headings.
     `tone`: "danger" for the danger zone's cards, "destructive" for one that destroys something. The outcome is said
     inline, in place of a toast: busy (a spinner), success, proposed (done, waiting on someone else) or failed with why.
     Text is resource keys or literal text. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../i18n';
  import Pill from './Pill.svelte';
  import Spinner from './Spinner.svelte';

  interface Props {
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text): what the form does, under the title. */
    help?: string;
    /** Icon name for the tile before the title. */
    icon?: string;
    tone?: 'default' | 'danger' | 'destructive';
    /** Resource key (or literal text): a pill at the end of the title line ("Set", "Destructive"). */
    tag?: string;
    tagTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
    /** The fields' columns; they stack when the card is narrow. */
    cols?: 1 | 2;
    /** Current and Proposed headings over the fields (CompareRows). */
    dual?: boolean;
    /** How the last attempt went: text is a resource key or literal text. */
    outcome?: { kind: 'busy' | 'success' | 'proposed' | 'failed'; text: string };
    /** At the end of the title line: a single switch, for a form that is only that. */
    aside?: Snippet;
    /** The fields. */
    children?: Snippet;
    /** Under the fields, over the footer: a note about something waiting. */
    notice?: Snippet;
    /** The form's buttons, at the footer's end. */
    actions?: Snippet;
  }

  let { title, help = '', icon = 'gear', tone = 'default', tag = '', tagTone = 'neutral', cols = 1, dual = false, outcome, aside, children, notice, actions }: Props = $props();
  const t = useT();

  const uid = $props.id();
  const OUTCOME_ICON = { success: 'check', proposed: 'clock', failed: 'warning' } as const;
</script>

<section class="settings-card {tone}" aria-labelledby="{uid}-title">
  <div class="head">
    <span class="tile" style:--card-icon="var(--icon-{icon})" aria-hidden="true"></span>
    <div class="text">
      <h3 class="title" id="{uid}-title">{t(title)}</h3>
      {#if help}<p class="help">{t(help)}</p>{/if}
    </div>
    {#if tag}<span class="tag"><Pill label={tag} tone={tagTone} /></span>{/if}
    {#if aside}<div class="aside">{@render aside()}</div>{/if}
  </div>
  {#if children}
    {#if dual}
      <div class="dual-head" aria-hidden="true"><span>{t('ui.settingsCard.current')}</span><span>{t('ui.settingsCard.proposed')}</span></div>
    {/if}
    <div class="body" class:two={cols === 2}>{@render children()}</div>
  {:else}
    <div class="spacer"></div>
  {/if}
  {#if notice}<div class="notice">{@render notice()}</div>{/if}
  {#if actions || outcome}
    <div class="foot">
      <div class="outcome {outcome?.kind ?? ''}" role="status" aria-live="polite">
        {#if outcome?.kind === 'busy'}
          <Spinner size={14} tone="ink" />
        {:else if outcome}
          <span class="outcome-icon" style:--outcome-icon="var(--icon-{OUTCOME_ICON[outcome.kind]})"></span>
        {/if}
        {#if outcome}<span>{t(outcome.text)}</span>{/if}
      </div>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </div>
  {/if}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  .settings-card {
    min-width: 0;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    container-type: inline-size;

    &.danger {
      box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--status-danger) 30%, var(--line-1));
    }

    &.destructive {
      background: color-mix(in oklch, var(--status-danger) 6%, transparent);
      box-shadow: inset 0 0 0 1.5px color-mix(in oklch, var(--status-danger) 55%, transparent);
    }
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-12);
    padding: var(--space-18) var(--space-18) 0;
  }

  .tile {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--overlay-2);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      margin: auto;
      width: 15px;
      height: 15px;
      background: var(--ink-2);
      mask: var(--card-icon) center/contain no-repeat;
    }

    .danger &,
    .destructive & {
      background: color-mix(in oklch, var(--status-danger) 14%, transparent);

      &::after {
        background: var(--status-danger);
      }
    }
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .title {
    margin: 0;
    font: var(--weight-semibold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .help {
    margin: 0;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .tag,
  .aside {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    align-self: center;
  }

  .dual-head {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-14);
    padding: var(--space-16) var(--space-18) 0;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-14);
    padding: var(--space-16) var(--space-18) var(--space-18);

    &.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .spacer {
    height: var(--space-18);
  }

  .notice {
    padding: 0 var(--space-18) var(--space-16);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-10);
    min-height: 56px;
    box-sizing: border-box;
    padding: var(--space-10) var(--space-14) var(--space-10) var(--space-18);
    border-top: 1px solid var(--line-1);
  }

  .outcome {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    font: var(--weight-medium) var(--text-md) / 1.4 var(--font-sans);
    color: var(--ink-2);

    &.success {
      color: var(--status-online);
    }

    &.proposed {
      color: var(--status-warning);
    }

    &.failed {
      color: var(--status-danger);
    }
  }

  .outcome-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: currentColor;
    mask: var(--outcome-icon) center/contain no-repeat;
  }

  .actions {
    flex: none;
    display: flex;
    gap: var(--space-8);
    margin-inline-start: auto;
  }

  @container (max-width: 520px) {
    .body.two {
      grid-template-columns: minmax(0, 1fr);
    }

    /* stacked, each CompareRow captions its own current value */
    .dual-head {
      display: none;
    }
  }
</style>
