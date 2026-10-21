<!-- Poll builder dialog (composer + → Poll). Question first; answers keep one empty row at the end (up to 10, drag/remove);
     duration pills; settings in a summary row that expands in place; live preview beside the form at ≥960px.
     Publish → onPublish(poll) (host closes and shows "Poll sent · Undo"); a promise is awaited (no second publish while it
     runs, no closing or discarding either) and a rejection keeps the poll with an error. Once it resolves the dialog
     stops taking input until the host closes it. Closing with content asks "Discard this poll?".
     Ctrl/⌘+Enter publishes; Enter in an answer moves to the next one. -->
<script lang="ts" module>
  export interface PollDraft {
    question: string;
    options: { label: string; votes: number }[];
    multiple: boolean;
    publicVotes: boolean;
    canChange: boolean;
    hideResults: boolean;
    /** How long it runs; stamp the end when it is actually sent. */
    durationMs: number;
    /** Display label for the duration ("1 day"). */
    endsIn: string;
    /** Now + durationMs at the moment Publish was pressed. */
    endsAt: number;
  }
</script>

<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import PollMessage from '../../lib/components/PollMessage.svelte';
  import SortableInputList from '../../lib/components/SortableInputList.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { getI18n, useT } from '../../lib/i18n';

  const Q_MAX = 250;
  const A_MAX = 75;
  // [label resource key, length in ms]
  const DURATIONS: [string, number][] = [
    ['ui.pollBuilderDialog.durations.hour1', 3600e3],
    ['ui.pollBuilderDialog.durations.hours6', 6 * 3600e3],
    ['ui.pollBuilderDialog.durations.day1', 86400e3],
    ['ui.pollBuilderDialog.durations.days3', 3 * 86400e3],
    ['ui.pollBuilderDialog.durations.week1', 7 * 86400e3],
    ['ui.pollBuilderDialog.durations.month1', 30 * 86400e3],
  ];

  interface Props {
    z?: number;
    /** Show the live preview beside the form on wide screens. */
    preview?: boolean;
    /** Reject to keep the dialog open with an error. */
    onPublish?: (poll: PollDraft) => Promise<unknown> | void;
    onClose?: () => void;
  }

  let { z = 80, preview = true, onPublish, onClose }: Props = $props();
  const t = useT();
  const i18n = getI18n();
  // dates in the host's locale; plain 'en' keeps the day-month order and 24-hour clock
  const dateLocale = () => (i18n.locale && i18n.locale !== 'en' ? i18n.locale : 'en-GB');

  let question = $state('');
  let answers = $state<string[]>(['', '']);
  let duration = $state(2);
  let publicVotes = $state(false);
  let multiple = $state(false);
  let locked = $state(false);
  let hideResults = $state(false);
  let settingsOpen = $state(false);
  let confirming = $state(false);
  // publish / after-publish lock: the shared dialog contract (lib/behaviours/dialog.svelte.ts)
  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
  let vw = $state(typeof window === 'undefined' ? 1200 : window.innerWidth);

  let box: HTMLDivElement;
  let questionField = $state<HTMLTextAreaElement>();

  // any edit clears a stale "couldn't publish", so the current validation reason shows again
  $effect(() => {
    void question;
    void answers;
    void duration;
    void publicVotes;
    void multiple;
    void locked;
    void hideResults;
    untrack(() => (flow.failed = false));
  });

  const wide = $derived(vw >= 960 && preview);
  const clean = $derived(answers.map((x) => x.trim()));
  const filled = $derived(clean.filter(Boolean));
  const isDup = (x: string, i: number) => !!x && clean.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i;
  const hasDup = $derived(clean.some(isDup));
  const ok = $derived(!!question.trim() && filled.length >= 2 && !hasDup);
  const end = $derived(new Date(Date.now() + DURATIONS[duration][1]));
  const reason = $derived(
    !question.trim()
      ? t('ui.pollBuilderDialog.addQuestion')
      : filled.length < 2
        ? t('ui.pollBuilderDialog.addTwoAnswers')
        : hasDup
          ? t('ui.pollBuilderDialog.answersDifferent')
          : t('ui.pollBuilderDialog.ready', {
              date: end.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }),
              time: end.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }),
            }),
  );

  const settings = $derived([
    { label: 'ui.pollBuilderDialog.settings.publicVotes', help: 'ui.pollBuilderDialog.settings.publicVotesHelp', on: publicVotes, toggle: () => (publicVotes = !publicVotes) },
    { label: 'ui.pollBuilderDialog.settings.multiple', help: 'ui.pollBuilderDialog.settings.multipleHelp', on: multiple, toggle: () => (multiple = !multiple) },
    { label: 'ui.pollBuilderDialog.settings.lockVotes', help: 'ui.pollBuilderDialog.settings.lockVotesHelp', on: locked, toggle: () => (locked = !locked) },
    { label: 'ui.pollBuilderDialog.settings.hideResults', help: 'ui.pollBuilderDialog.settings.hideResultsHelp', on: hideResults, toggle: () => (hideResults = !hideResults) },
  ]);
  const summary = $derived(
    [
      publicVotes ? 'ui.pollBuilderDialog.summary.publicVotes' : 'ui.pollBuilderDialog.summary.anonymous',
      multiple ? 'ui.pollBuilderDialog.summary.multiple' : 'ui.pollBuilderDialog.summary.single',
      locked ? 'ui.pollBuilderDialog.summary.locked' : 'ui.pollBuilderDialog.summary.canChange',
      hideResults ? 'ui.pollBuilderDialog.summary.resultsHidden' : 'ui.pollBuilderDialog.summary.resultsVisible',
    ]
      .map((k) => t(k))
      .join(' · '),
  );

  // question field grows with its content (no fixed rows)
  function grow(t: HTMLTextAreaElement | undefined) {
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }

  async function publish() {
    if (!ok) return;
    const ms = DURATIONS[duration][1];
    const result = await flow.run(() =>
      onPublish?.({
        question: question.trim(),
        options: filled.map((label) => ({ label, votes: 0 })),
        multiple,
        publicVotes,
        canChange: !locked,
        hideResults,
        durationMs: ms,
        endsIn: t(DURATIONS[duration][0]),
        // stamped now, not when the duration was picked
        endsAt: Date.now() + ms,
      }),
    );
    // published: no second publish while the host closes it
    if (result.ok) flow.leave();
  }

  // closing with content asks first; an empty poll just closes. Nothing closes while a publish is pending: the poll may
  // still be posted, and its result (or error) has to be seen here
  function requestClose() {
    if (flow.locked) return;
    if (question.trim() || filled.length) confirming = true;
    else onClose?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      publish();
      return;
    }
    const target = e.target as HTMLElement;
    if (e.key === 'Enter' && target.tagName === 'INPUT') {
      e.preventDefault();
      const answerInputs = () => [...box.querySelectorAll<HTMLInputElement>('input[data-sortable-input]')];
      const i = answerInputs().indexOf(target as HTMLInputElement);
      setTimeout(() => answerInputs()[i + 1]?.focus(), 0);
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (flow.locked) return;
      if (confirming) confirming = false;
      else requestClose();
    }
  }

  onMount(() => {
    const resize = () => {
      grow(questionField);
      vw = window.innerWidth;
    };
    window.addEventListener('resize', resize);
    const focusTimer = setTimeout(() => {
      resize();
      box.querySelector('textarea')?.focus();
    }, 60);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('resize', resize);
    };
  });
</script>

<div class="layer" class:closing={flow.closing} style:z-index={z}>
  <div class="scrim" onclick={requestClose} aria-hidden="true"></div>
  <div class="dialog" class:wide bind:this={box} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={t('ui.pollBuilderDialog.title')} onkeydown={onKey}>
    <div class="header">
      <span class="heading">{t('ui.pollBuilderDialog.title')}</span>
      <IconButton variant="ghost" icon="close" label="ui.common.close" onClick={requestClose} />
    </div>
    <div class="content">
      <div class="form">
        <div class="section">
          <label class="label" for="poll-question">{t('ui.pollBuilderDialog.question')}</label>
          <div class="question">
            <textarea
              id="poll-question"
              bind:this={questionField}
              rows="2"
              data-autogrow=""
              value={question}
              oninput={(e) => {
                grow(e.currentTarget);
                question = e.currentTarget.value.slice(0, Q_MAX);
              }}
              placeholder={t('ui.pollBuilderDialog.questionPlaceholder')}
              aria-label={t('ui.pollBuilderDialog.questionLabel')}
            ></textarea>
            {#if Q_MAX - question.length <= 40}<span class="left">{Q_MAX - question.length}</span>{/if}
          </div>
        </div>
        <div class="section">
          <div class="label-row"><span class="label">{t('ui.pollBuilderDialog.answers')}</span><span class="hint">{filled.length < 2 ? t('ui.pollBuilderDialog.atLeastTwo') : t('ui.pollBuilderDialog.answersCount', { count: filled.length, max: 10 })}</span></div>
          <div class="answers">
            <SortableInputList values={answers} onChange={(vals) => (answers = [...vals, ''])} min={2} max={10} maxLength={A_MAX} itemLabel="ui.pollBuilderDialog.answer" label="ui.pollBuilderDialog.answersLabel" />
          </div>
        </div>
        <div class="section durations-section">
          <span class="label">{t('ui.pollBuilderDialog.duration')}</span>
          <div class="durations" role="radiogroup" aria-label={t('ui.pollBuilderDialog.durationLabel')}>
            {#each DURATIONS as [label], i}
              <span class="duration" class:on={i === duration} onclick={() => (duration = i)} role="radio" aria-checked={i === duration} tabindex="0">{t(label)}</span>
            {/each}
          </div>
        </div>
        <div class="settings">
          <span class="settings-row" onclick={() => (settingsOpen = !settingsOpen)} role="button" tabindex="0" aria-expanded={settingsOpen}>
            <span class="gear"></span>
            <span class="settings-text"><span class="settings-title">{t('ui.common.settings')}</span><span class="settings-summary">{summary}</span></span>
            <span class="chevron" class:open={settingsOpen}></span>
          </span>
          {#if settingsOpen}
            <div class="settings-list">
              {#each settings as s}
                <div class="setting">
                  <span class="setting-text"><span class="setting-label">{t(s.label)}</span><span class="setting-help">{t(s.help)}</span></span>
                  <Toggle on={s.on} ariaLabel={s.label} onChange={s.toggle} />
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      {#if wide}
        <div class="preview">
          <span class="preview-label">{t('ui.pollBuilderDialog.preview')}</span>
          <PollMessage
            side="sent"
            question={question.trim() || t('ui.pollBuilderDialog.yourQuestion')}
            options={(filled.length ? filled : [1, 2].map((n) => t('ui.pollBuilderDialog.answerN', { n }))).map((label) => ({ label, votes: 0 }))}
            {multiple}
            {publicVotes}
            canChange={!locked}
            endsIn={t(DURATIONS[duration][0])}
            time={t('ui.pollBuilderDialog.now')}
          />
        </div>
      {/if}
    </div>
    <div class="footer">
      {#if flow.failed}
        <span class="reason failed" role="alert">{t('ui.pollBuilderDialog.publishFailed')}</span>
      {:else}
        <span class="reason" class:ok>{reason}</span>
      {/if}
      <span class="publish" class:ok={ok && !flow.locked} onclick={publish} role="button" tabindex={ok ? 0 : -1} aria-disabled={!ok || flow.locked}><span class="publish-icon"></span>{t('ui.pollBuilderDialog.publish')}</span>
    </div>
    {#if confirming}
      <div class="confirm-layer">
        <div class="confirm" role="alertdialog" aria-label={t('ui.pollBuilderDialog.discardTitle')}>
          <span class="confirm-title">{t('ui.pollBuilderDialog.discardTitle')}</span>
          <span class="confirm-text">{t('ui.pollBuilderDialog.discardText')}</span>
          <div class="confirm-actions">
            <Button label="ui.pollBuilderDialog.keepEditing" variant="ghost" onClick={() => (confirming = false)} />
            <Button label="ui.pollBuilderDialog.discard" variant="danger" onClick={() => !flow.locked && onClose?.()} />
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .layer.closing {
    pointer-events: none;
  }

  .layer {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: 540px;
    max-height: 100%;
    outline: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 24px 64px rgba(0, 0, 0, 0.45);
  }

  .dialog.wide {
    max-width: 900px;
  }

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--header-h, 66px);
    box-sizing: border-box;
    padding: 0 12px 0 22px;
    border-bottom: 1px solid var(--line-1);
  }

  .heading {
    flex: 1;
    font: 700 17px/1 var(--font-sans);
    color: var(--ink);
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .wide .content {
    grid-template-columns: minmax(0, 1fr) 374px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 20px 22px 22px;
    min-width: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .durations-section {
    gap: 10px;
  }

  .label {
    font: 600 13px/1 var(--font-sans);
    color: var(--ink-2);
  }

  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .hint {
    font: 400 12px/1 var(--font-sans);
    color: var(--ink-4);
  }

  .question {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    overflow: hidden;
    min-height: 44px;
    border: 0;
    outline: none;
    background: transparent;
    padding: 0;
    font: 600 15px/1.45 var(--font-sans);
    color: var(--ink);
  }

  .left {
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-4);
  }

  .answers {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .durations {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
  }

  .duration {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 4px;
    white-space: nowrap;
    overflow: hidden;
    border-radius: 17px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: 600 12.5px/1 var(--font-sans);
    letter-spacing: -0.01em;
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .duration.on {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1.5px var(--accent);
    color: var(--accent-bright);
  }

  .settings {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .settings-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 8px 14px;
    cursor: pointer;
  }

  .gear {
    width: 16px;
    height: 16px;
    background: var(--ink-3);
    mask: var(--icon-gear) center/contain no-repeat;
  }

  .settings-text,
  .setting-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .settings-title {
    font: 600 13.5px/1.2 var(--font-sans);
    color: var(--ink);
  }

  .settings-summary {
    font: 400 12px/1.35 var(--font-sans);
    color: var(--ink-3);
  }

  .chevron {
    width: 12px;
    height: 12px;
    background: var(--ink-3);
    mask: var(--icon-chevron-down) center/contain no-repeat;
    transition: transform var(--duration-base);
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    padding: 0 14px 6px;
    border-top: 1px solid var(--line-1);
  }

  .setting {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 10px 0;
  }

  .setting-label {
    font: 600 13.5px/1.3 var(--font-sans);
    color: var(--ink);
  }

  .setting-help {
    font: 400 12.5px/1.45 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 22px;
    border-left: 1px solid var(--line-1);
    background: var(--surface-0);
  }

  .preview-label {
    font: 600 10.5px/1 var(--font-mono);
    letter-spacing: 0.08em;
    color: var(--ink-4);
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 22px;
    border-top: 1px solid var(--line-1);
  }

  .reason {
    flex: 1;
    min-width: 0;
    font: 500 12.5px/1.4 var(--font-sans);
    color: var(--status-warning);
    text-wrap: pretty;
  }

  .reason.failed {
    color: var(--status-danger);
  }

  .reason.ok {
    color: var(--ink-3);
  }

  .publish {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 18px;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: 600 14px/1 var(--font-sans);
    color: var(--ink-4);
    cursor: not-allowed;
  }

  .publish.ok {
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }

  .publish-icon {
    width: 15px;
    height: 15px;
    background: currentColor;
    mask: var(--icon-poll) center/contain no-repeat;
  }

  .confirm-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--scrim);
    backdrop-filter: blur(4px);
  }

  .confirm {
    width: min(360px, 100%);
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 18px;
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 18px 48px rgba(0, 0, 0, 0.5);
  }

  .confirm-title {
    font: 700 16px/1.2 var(--font-sans);
    color: var(--ink);
  }

  .confirm-text {
    font: 400 13px/1.5 var(--font-sans);
    color: var(--ink-3);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
