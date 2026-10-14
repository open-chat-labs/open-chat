<!-- Create a channel in a community, or (embedded) add a channel that shows a web app in place of messages.
     Name is slugged as you type; create arms once the name has 2+ characters (and, embedded, the URL looks valid).
     checkName (optional) reports whether the name is free in the community; a taken name blocks create.
     Create awaits onCreate ("Creating…"): the dialog closes once it resolves and keeps the form with an error if it
     rejects. Esc, the veil, the × and Cancel close with the exit animation, except while creating. -->
<script lang="ts" module>
  export interface NewChannel {
    name: string;
    about: string;
    isPublic: boolean;
    embedded: boolean;
    url: string;
  }

  export type NameCheck = 'ok' | 'taken' | 'invalid';
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { onDestroy, untrack } from 'svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import { modal } from '../../lib/behaviours/modal';

  interface Props {
    communityName: string;
    embedded?: boolean;
    /** Whether a new channel starts public. */
    defaultPublic?: boolean;
    /** Is this channel name free in the community? Checked as the user types (debounced). */
    checkName?: (name: string) => Promise<NameCheck>;
    onCancel?: () => void;
    /** Create it. The dialog closes when this resolves; a rejection keeps it open with an error. */
    onCreate?: (c: NewChannel) => Promise<unknown> | void;
  }

  let { communityName, embedded = false, defaultPublic = false, checkName, onCancel, onCreate }: Props = $props();
  const t = useT();

  const slug = (v: string) =>
    v
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '');

  let name = $state('');
  let about = $state('');
  let url = $state('');
  let isPublic = $state(untrack(() => defaultPublic));
  let creating = $state(false);
  let failed = $state(false);

  // name availability: the latest answer for the current name ('pending' while a check runs)
  let nameState = $state<{ name: string; result: NameCheck | 'pending' } | null>(null);
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  function typedName(value: string) {
    name = slug(value);
    clearTimeout(checkTimer);
    nameState = null;
    if (!checkName || name.length < 2) return;
    const asked = name;
    nameState = { name: asked, result: 'pending' };
    checkTimer = setTimeout(async () => {
      let result: NameCheck | null;
      try {
        result = await checkName(asked);
      } catch {
        result = null; // can't tell; the host still validates on create
      }
      if (name === asked) nameState = result ? { name: asked, result } : null;
    }, 400);
  }
  const nameResult = $derived(nameState?.name === name ? nameState.result : null);

  const ok = $derived(name.length > 1 && (!embedded || /^https?:\/\/\S+\.\S+/.test(url.trim())) && (nameResult === null || nameResult === 'ok'));

  let closing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    clearTimeout(timer);
    clearTimeout(checkTimer);
  });

  // play the exit animation, then hand control back
  function close(then?: () => void) {
    if (closing || creating) return;
    closing = true;
    timer = setTimeout(() => then?.(), 170);
  }

  async function create() {
    if (!ok || creating) return;
    const result = { name, about, isPublic, embedded, url: url.trim() };
    creating = true;
    failed = false;
    try {
      await onCreate?.(result);
    } catch {
      failed = true;
      return;
    } finally {
      creating = false;
    }
    // animate out and stay hidden; the host unmounts the dialog once onCreate has resolved
    closing = true;
  }
</script>

<div class="layer" class:closing role="dialog" aria-modal="true" use:modal={() => close(onCancel)}>
  <div class="veil" onclick={() => close(onCancel)} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      <span class="badge"><span class="head-icon" class:embedded></span></span>
      <div class="titles">
        <span class="title">{t(embedded ? 'ui.newChannelDialog.titleEmbedded' : 'ui.newChannelDialog.title')}</span>
        <span class="subtitle">{t('ui.newChannelDialog.subtitle', { community: communityName })}</span>
      </div>
      <span class="close" onclick={() => close(onCancel)} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      <label class="field">
        <span class="label">{t('ui.newChannelDialog.nameLabel')}</span>
        <div class="name-box" class:filled={!!name}>
          <span class="hash">#</span>
          <input value={name} oninput={(e) => typedName(e.currentTarget.value)} placeholder={t('ui.newChannelDialog.namePlaceholder')} maxlength="40" />
        </div>
        <span class="hint" class:bad={nameResult === 'taken' || nameResult === 'invalid'} role={nameResult === 'taken' || nameResult === 'invalid' ? 'alert' : undefined}
          >{t(
            nameResult === 'taken'
              ? 'ui.newChannelDialog.nameTaken'
              : nameResult === 'invalid'
                ? 'ui.newChannelDialog.nameInvalid'
                : nameResult === 'pending'
                  ? 'ui.newChannelDialog.nameChecking'
                  : 'ui.newChannelDialog.nameHint',
          )}</span
        >
      </label>

      {#if embedded}
        <label class="field">
          <span class="label">{t('ui.newChannelDialog.urlLabel')}</span>
          <input class="box url" bind:value={url} placeholder="https://" />
          <span class="hint wrap">{t('ui.newChannelDialog.urlHint')}</span>
        </label>
      {/if}

      <label class="field">
        <span class="label">{t('ui.newChannelDialog.descriptionLabel')} <span class="optional">{t('ui.newChannelDialog.optional')}</span></span>
        <textarea class="box" bind:value={about} rows="3" placeholder={t('ui.newChannelDialog.descriptionPlaceholder')}></textarea>
      </label>

      <div class="visibility">
        <div class="vis-text">
          <span class="vis-title">{t('ui.newChannelDialog.publicTitle')}</span>
          <span class="vis-hint">{t(isPublic ? 'ui.newChannelDialog.publicHint' : 'ui.newChannelDialog.privateHint')}</span>
        </div>
        <div class="vis-toggle"><Toggle on={isPublic} onChange={(v) => (isPublic = v)} /></div>
      </div>
    </div>

    <div class="foot">
      <span class="cancel" onclick={() => close(onCancel)} role="button" tabindex="0" aria-disabled={creating}>{t('ui.common.cancel')}</span>
      <span class="grow"></span>
      {#if failed}
        <span class="error" role="alert">{t('ui.newChannelDialog.createFailed')}</span>
      {/if}
      <div class="cta" class:ok={ok && !creating} onclick={create} role="button" tabindex="0" aria-disabled={!ok || creating}>
        <span class="cta-icon" class:embedded></span>
        <span>{t(creating ? 'ui.newChannelDialog.creating' : embedded ? 'ui.newChannelDialog.addCta' : 'ui.newChannelDialog.createCta')}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger, #f5493d);
  }

  .hint.bad {
    color: var(--status-danger, #f5493d);
  }

  .layer {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-22);
  }

  .veil {
    position: absolute;
    inset: 0;
    background: var(--oc-veil, rgba(3, 3, 6, 0.72));
    backdrop-filter: var(--oc-veil-blur, blur(4px));
    -webkit-backdrop-filter: var(--oc-veil-blur, blur(4px));
    animation: oc-veil-in var(--duration-base, 200ms) var(--ease-out) both;
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 500px;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .closing .veil {
    animation: oc-veil-out 170ms var(--ease-standard) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-18);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .head-icon,
  .cta-icon {
    mask: var(--icon-hash) center/contain no-repeat;
  }

  .head-icon.embedded,
  .cta-icon.embedded {
    mask: var(--icon-embed) center/contain no-repeat;
  }

  .head-icon {
    width: 19px;
    height: 19px;
    background: var(--ink-2, #b9b9c6);
  }

  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .close:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-24) var(--space-18);
    display: flex;
    flex-direction: column;
    gap: var(--space-18);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .label {
    padding-inline-start: var(--space-4);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2, #c9c9d4);
  }

  .optional {
    font-weight: var(--weight-regular);
    color: var(--ink-4, #7c7c8c);
  }

  .name-box {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: 44px;
    padding: 0 var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
  }

  .name-box.filled {
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(255, 255, 255, 0.22));
  }

  .hash {
    flex: none;
    font: var(--weight-bold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }

  .name-box input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font: var(--weight-medium) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .box {
    box-sizing: border-box;
    border: none;
    outline: none;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1));
    color: var(--ink, #ececf1);
  }

  .box.url {
    height: 44px;
    padding: 0 var(--space-14);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
  }

  textarea.box {
    resize: none;
    padding: var(--space-12) var(--space-14);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
  }

  .hint {
    padding-inline-start: var(--space-4);
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .hint.wrap {
    line-height: 1.45;
    text-wrap: pretty;
  }

  .visibility {
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-14) var(--space-16);
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .vis-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .vis-title {
    font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .vis-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-3, #8a8a99);
    text-wrap: pretty;
  }

  .vis-toggle {
    flex: none;
    display: flex;
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-18);
    border-block-start: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .cancel {
    flex: none;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent, #ff5672);
    cursor: pointer;
    user-select: none;
  }

  .cancel:hover {
    background: var(--accent-soft, rgba(255, 86, 114, 0.1));
  }

  .grow {
    flex: 1;
  }

  .cta {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: 44px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    cursor: default;
    user-select: none;
  }

  .cta.ok {
    background: var(--accent, #ff5672);
    color: var(--on-accent, #2e0512);
    cursor: pointer;
  }

  .cta-icon {
    width: 16px;
    height: 16px;
    background: currentColor;
  }
</style>
