<!-- Register or edit a group webhook: avatar (photo or colour), name (letters, digits, underscores; unique in the chat,
     checked against `takenNames`), and in edit mode the secret URL (click to copy) with a guarded "Regenerate" that
     confirms before replacing the secret. The secret is always issued by the host: onRegenerate resolves with the new URL,
     which is only shown once it arrives. Save and regenerate wait on the host and keep everything on rejection. -->
<script lang="ts" module>
  export type WebhookColour = 'slate' | 'teal' | 'blue' | 'plum' | 'amber' | 'rose';

  export interface WebhookSave {
    /** Missing when registering a new webhook. */
    id?: string;
    name: string;
    color: WebhookColour;
    /** A newly picked photo, for the host to upload. */
    avatar: File | null;
    /** The existing photo was removed. */
    removeAvatar: boolean;
  }
</script>

<script lang="ts">
  import { useT } from '../../lib/i18n';
  import CopyButton from '../../lib/components/CopyButton.svelte';
  import Translate from '../../lib/components/Translate.svelte';
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import { cssUrl } from '../../lib/cssUrl';

  const GRADIENTS = {
    slate: 'linear-gradient(140deg,#8E9BB3,#5A6478)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
    plum: 'linear-gradient(140deg,#B06BFF,#6A2BFF)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    rose: 'linear-gradient(140deg,#FF6B8B,#C13584)',
  };
  type Colour = WebhookColour;

  const VALID = /^[A-Za-z0-9_]+$/;
  const NAME_MAX = 30;
  const LEAVE_MS = 170;

  interface Webhook {
    id: string;
    name: string;
    color?: Colour;
    url: string;
    avatarUrl?: string | null;
  }

  interface Props {
    dialogMode?: 'register' | 'edit';
    /** The webhook being edited (edit mode). */
    webhook?: Webhook | null;
    groupName: string;
    /** Names already used by webhooks in this chat (the one being edited may be included). */
    takenNames?: string[];
    /** Register (no id) or update a webhook. The dialog closes when this resolves and keeps the form if it rejects. */
    onSave?: (hook: WebhookSave) => Promise<unknown> | void;
    /** Replace the secret; resolve with the new URL. Hidden without it. */
    onRegenerate?: (hook: { id: string }) => Promise<{ url: string }>;
    /** Remove the webhook, after the user confirms; the dialog closes when this resolves. Hidden without it. */
    onDelete?: (hook: { id: string }) => Promise<unknown> | void;
    onCancel?: () => void;
  }

  let { dialogMode = 'register', webhook = null, groupName, takenNames = [], onSave, onRegenerate, onDelete, onCancel }: Props = $props();
  const t = useT();

  let nameEdit = $state<string | null>(null);
  let colourEdit = $state<Colour | null>(null);
  let urlEdit = $state<string | null>(null);
  // a newly picked photo: the File goes to the host, the object URL is only the preview
  let photoFile = $state<File | null>(null);
  let photoEdit = $state<string | null>(null);
  let photoRemoved = $state(false);
  // one flow for both host calls (save leaves on success, regenerate stays): busy / leaving / the exit
  // (lib/behaviours/dialog.svelte.ts); `action` says which call the busy / failed state belongs to
  const flow = new DialogFlow({ exitMs: LEAVE_MS });
  let action = $state<'save' | 'regenerate' | 'delete'>('save');
  const busy = $derived(flow.busy ? action : '');
  const failed = $derived(flow.failed ? action : '');
  // the confirm step shown in place of the form: replacing the secret, or removing the webhook
  let confirm = $state<'regenerate' | 'delete' | null>(null);
  const confirming = $derived(confirm !== null);
  let copied = $state(false);
  let regenerated = $state(false);
  let explainer = $state(false);
  let avatarInput: HTMLInputElement;
  onDestroy(() => {
    flow.destroy();
    if (photoEdit) URL.revokeObjectURL(photoEdit);
  });

  const isEdit = $derived(dialogMode === 'edit');
  const name = $derived(nameEdit ?? webhook?.name ?? '');
  const colour = $derived(colourEdit ?? webhook?.color ?? 'slate');
  const url = $derived(urlEdit ?? webhook?.url ?? '');
  const photo = $derived(photoEdit ?? (photoRemoved ? null : (webhook?.avatarUrl ?? null)));
  const taken = $derived(!!name && name.toLowerCase() !== webhook?.name.toLowerCase() && takenNames.some((n) => n.toLowerCase() === name.toLowerCase()));
  const valid = $derived(VALID.test(name) && !taken);
  const invalid = $derived(name.length > 0 && !VALID.test(name));

  async function save() {
    // nothing new while a call is pending or once leaving (cancelled, or the exit after a success)
    if (!valid || flow.locked || !onSave) return;
    const saveFn = onSave;
    action = 'save';
    const result = await flow.run(() =>
      saveFn({ id: isEdit ? webhook?.id : undefined, name, color: colour, avatar: photoFile, removeAvatar: photoRemoved && !photoFile }),
    );
    if (result.ok) flow.leave(onCancel);
  }

  // the new URL is shown only once the host has issued it; a failure keeps the old one
  async function regenerate() {
    if (flow.locked || !onRegenerate || !webhook) return;
    const regen = onRegenerate, id = webhook.id;
    action = 'regenerate';
    const result = await flow.run(() => regen({ id }));
    if (!result.ok) return;
    urlEdit = result.value.url;
    confirm = null;
    regenerated = true;
    copied = false;
  }

  async function remove() {
    if (flow.locked || !onDelete || !webhook) return;
    const del = onDelete, id = webhook.id;
    action = 'delete';
    const result = await flow.run(() => del({ id }));
    if (result.ok) flow.leave(onCancel);
  }

  // the URL itself is a second way to copy
  let copier = $state<CopyButton>();

  function pickedFile(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    if (photoEdit) URL.revokeObjectURL(photoEdit);
    photoFile = f;
    photoEdit = URL.createObjectURL(f);
    e.currentTarget.value = '';
  }

  function clearPhoto() {
    if (photoEdit) URL.revokeObjectURL(photoEdit);
    photoEdit = null;
    photoFile = null;
    photoRemoved = true;
  }

  const dismiss = () => flow.dismiss(onCancel);
</script>

<div class="layer oc-dialog-layer" class:closing={flow.closing} role="dialog" aria-modal="true" use:modal={flow.escape(onCancel)}>
  <div class="oc-veil" onclick={dismiss} aria-hidden="true"></div>
  <div class="card">
    <div class="head">
      {#if confirming}
        <span class="head-tile warn"><span class="head-glyph" style:mask="var(--icon-{confirm === 'delete' ? 'trash' : 'refresh'}) center/contain no-repeat"></span></span>
      {:else if isEdit}
        <span class="head-avatar" style:background={GRADIENTS[colour] ?? GRADIENTS.slate}>
          <span class="photo" style:background={photo ? `${cssUrl(photo)} center/cover no-repeat` : 'none'}></span>
          <span class="hook-badge"><span class="hook-badge-icon"></span></span>
        </span>
      {:else}
        <span class="head-tile"><span class="head-glyph" style:mask="var(--icon-hook) center/contain no-repeat"></span></span>
      {/if}
      <div class="head-text">
        <span class="head-title">{confirm === 'delete' ? t('ui.webhookDialog.deleteTitle') : confirming ? t('ui.webhookDialog.regenerateTitle') : isEdit ? name : t('ui.webhookDialog.registerTitle')}</span>
        <span class="head-sub">{confirming ? `${name} · ${groupName}` : isEdit ? t('ui.webhookDialog.inGroup', { group: groupName }) : groupName}</span>
      </div>
      <span class="close" onclick={dismiss} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-icon"></span></span>
    </div>

    <div class="body">
      {#if !confirming}
        <div class="section big-gap">
          <div class="avatar-row">
            <div class="avatar-wrap">
              <div class="avatar" style:background={GRADIENTS[colour] ?? GRADIENTS.slate}>
                <div class="avatar-photo" style:background={photo ? `${cssUrl(photo)} center/cover no-repeat` : 'none'}></div>
              </div>
              <input class="file" bind:this={avatarInput} type="file" accept="image/*" oninput={pickedFile} />
              <div class="upload" onclick={() => avatarInput.click()} role="button" tabindex="0" aria-label={t('ui.webhookDialog.uploadImage')} title={t('ui.webhookDialog.uploadImage')}><span class="upload-icon"></span></div>
            </div>
            <div class="swatches">
              {#each Object.entries(GRADIENTS) as [key, gradient]}
                <span
                  class="swatch"
                  class:selected={key === colour}
                  style:background={gradient}
                  onclick={() => (colourEdit = key as Colour)}
                  role="button"
                  tabindex="0"
                  aria-label={t('ui.webhookDialog.colour.' + key)}
                  title={t('ui.webhookDialog.colour.' + key)}
                ></span>
              {/each}
              {#if photo}
                <span class="remove-photo" onclick={clearPhoto} role="button" tabindex="0">{t('ui.webhookDialog.removePhoto')}</span>
              {/if}
            </div>
          </div>

          <div class="field-group">
            <span class="caption">{t('ui.webhookDialog.nameCaption')}</span>
            <div class="field" class:invalid>
              <input value={name} oninput={(e) => (nameEdit = e.currentTarget.value.slice(0, NAME_MAX))} placeholder={t('ui.webhookDialog.namePlaceholder')} maxlength="30" />
              <span class="left">{NAME_MAX - name.length}</span>
            </div>
            <span class="hint" class:invalid={invalid || taken}>
              {t(invalid ? 'ui.webhookDialog.nameInvalid' : taken ? 'ui.webhookDialog.nameTaken' : 'ui.webhookDialog.nameHint')}
            </span>
            {#if isEdit}
              <span class="hint">{t('ui.webhookDialog.renameHint')}</span>
            {/if}
          </div>

          {#if !isEdit}
            <div class="section">
              <div class="note-row">
                <span class="note">{t('ui.webhookDialog.registerNote', { group: groupName })}</span>
                <span class="explainer-toggle" onclick={() => (explainer = !explainer)} role="button" tabindex="0">
                  <span>{t(explainer ? 'ui.webhookDialog.hideDetails' : 'ui.webhookDialog.howItWorks')}</span>
                  <span class="chevron" class:open={explainer}></span>
                </span>
              </div>
              {#if explainer}
                <span class="explainer"
                  ><Translate key="ui.webhookDialog.explainer">{#snippet link()}<a href="#">{t('ui.webhookDialog.explainerLink')}</a>{/snippet}</Translate></span
                >
              {/if}
            </div>
          {/if}
        </div>

        {#if isEdit}
          <div class="section url-section">
            <span class="caption bright">{t('ui.webhookDialog.urlCaption')}</span>
            {#if regenerated}
              <div class="regenerated">
                <span class="regenerated-icon"></span>
                <span class="regenerated-text">{t('ui.webhookDialog.regenerated')}</span>
              </div>
            {/if}
            <div class="url-box">
              <div class="url-head">
                <span class="copy-hint">{t(copied ? 'ui.webhookDialog.copied' : 'ui.webhookDialog.clickToCopy')}</span>
                <CopyButton bind:this={copier} bind:copied value={url} label="ui.webhookDialog.copyUrl" variant="soft" size="md" />
              </div>
              <span class="url" onclick={() => copier?.copy()} role="button" tabindex="0">{url}</span>
            </div>
            {#if onRegenerate}
              <div class="regen-row">
                <span class="regen-note">{t('ui.webhookDialog.regenNote')}</span>
                <span class="regen" onclick={() => !flow.locked && (confirm = 'regenerate')} role="button" tabindex="0"><span class="regen-icon"></span><span class="regen-label">{t('ui.webhookDialog.regenerate')}</span></span>
              </div>
            {/if}
          </div>
        {/if}
      {:else if confirm === 'delete'}
        <div class="section">
          <span class="caption">{t('ui.webhookDialog.deleteBody', { name })}</span>
          <div class="old-url"><span class="url struck">{url}</span></div>
        </div>
      {:else}
        <div class="section">
          <span class="caption">{t('ui.webhookDialog.stopsWorking')}</span>
          <div class="old-url"><span class="url struck">{url}</span></div>
        </div>

        <div class="section">
          <span class="caption">{t('ui.webhookDialog.afterConfirm')}</span>
          <div class="after">
            <span class="after-icon"></span>
            <span class="after-text">{t('ui.webhookDialog.afterText')}</span>
          </div>
        </div>

        <div class="warning">
          <span class="warning-icon"></span>
          <span class="warning-text">{t('ui.webhookDialog.warning')}</span>
        </div>
      {/if}
    </div>

    <div class="foot">
      <span class="secondary" onclick={() => (flow.locked ? undefined : confirming ? (confirm = null) : dismiss())} role="button" tabindex="0" aria-disabled={flow.locked}>{t(confirming ? 'ui.common.back' : 'ui.common.cancel')}</span>
      {#if isEdit && onDelete && !confirming}
        <span class="danger-link" onclick={() => !flow.locked && (confirm = 'delete')} role="button" tabindex="0" aria-disabled={flow.locked}>{t('ui.webhookDialog.delete')}</span>
      {/if}
      <span class="spacer"></span>
      {#if failed}
        <span class="error" role="alert">{t(failed === 'save' ? 'ui.webhookDialog.saveFailed' : failed === 'delete' ? 'ui.webhookDialog.deleteFailed' : 'ui.webhookDialog.regenerateFailed')}</span>
      {/if}
      <div
        class="primary"
        class:warn={confirming}
        class:ready={!flow.locked && (confirming || (valid && !!onSave))}
        onclick={() => (confirm === 'delete' ? remove() : confirming ? regenerate() : save())}
        role="button"
        tabindex="0"
        aria-disabled={flow.locked || (!confirming && (!valid || !onSave))}
      >
        <span>{t(busy ? 'ui.webhookDialog.working' : confirm === 'delete' ? 'ui.webhookDialog.deleteCta' : confirming ? 'ui.webhookDialog.regenerateCta' : isEdit ? 'ui.webhookDialog.updateCta' : 'ui.webhookDialog.registerCta')}</span>
        <span class="primary-icon" style:mask="var(--icon-{confirm === 'delete' ? 'trash' : confirming ? 'refresh' : isEdit ? 'check' : 'hook'}) center/contain no-repeat"></span>
      </div>
    </div>
  </div>
</div>

<style>

  .layer {
    z-index: 70;
  }

  .error {
    font: var(--weight-medium) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--status-danger);
  }

  .card {
    position: relative;
    width: 100%;
    max-width: 600px;
    max-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .closing .card {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-16) var(--space-26);
    border-block-end: 1px solid var(--line-1);
  }

  .head-avatar {
    position: relative;
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
  }

  .photo {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .hook-badge {
    position: absolute;
    inset-inline-end: -5px;
    inset-block-end: -5px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-pill);
    background: var(--card);
    box-shadow: inset 0 0 0 1px var(--line-2);
  }

  .hook-badge-icon {
    width: 11px;
    height: 11px;
    background: var(--accent);
    mask: var(--icon-hook) center/contain no-repeat;
  }

  .head-tile {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: var(--radius-md);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent-dim);
  }

  .head-glyph {
    width: 19px;
    height: 19px;
    background: var(--accent);
  }

  .head-tile.warn {
    background: var(--status-chit-soft);
    box-shadow: inset 0 0 0 1px var(--status-chit);
  }

  .warn .head-glyph {
    background: var(--status-chit);
  }

  .head-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .head-title,
  .head-sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .head-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .head-sub {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
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

  .close:hover,
  .upload:hover {
    background: var(--overlay-2);
  }

  .close-icon {
    width: 15px;
    height: 15px;
    background: var(--ink-3);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: var(--space-26) var(--space-26) var(--space-32);
    display: flex;
    flex-direction: column;
    gap: var(--space-32);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    min-width: 0;
  }

  .section.big-gap {
    gap: var(--space-32);
  }

  .url-section {
    gap: var(--space-12);
  }

  .avatar-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-16);
    min-width: 0;
  }

  .avatar-wrap {
    position: relative;
    flex: none;
    width: 64px;
    height: 64px;
  }

  .avatar,
  .avatar-photo {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-lg);
  }

  .avatar-photo {
    width: 100%;
    height: 100%;
  }

  .file {
    display: none;
  }

  .upload {
    position: absolute;
    inset-inline-end: -4px;
    inset-block-end: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 4px 12px rgba(0, 0, 0, 0.4);
    cursor: pointer;
  }

  .upload-icon {
    width: 14px;
    height: 14px;
    background: var(--ink);
    mask: var(--icon-edit) center/contain no-repeat;
  }

  .swatches {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8);
  }

  .swatch {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 38%;
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
  }

  .swatch.selected {
    box-shadow:
      0 0 0 2px var(--surface-1),
      0 0 0 4px var(--accent);
  }

  .remove-photo {
    flex: none;
    padding: var(--space-4) var(--space-10);
    border-radius: var(--radius-sm);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }

  .remove-photo:hover {
    background: var(--btn-hover);
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
  }

  .caption {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4);
  }

  .caption.bright {
    color: var(--ink-3);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding: 0 var(--space-16);
    height: 52px;
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .field.invalid {
    box-shadow: inset 0 0 0 1px var(--status-danger);
  }

  .field input {
    flex: 1;
    min-width: 0;
    background: none;
    border: 0;
    outline: none;
    font: var(--weight-semibold) var(--text-lg) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .left {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-4);
  }

  .hint {
    padding-inline-start: var(--space-16);
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .hint.invalid {
    color: var(--status-danger);
  }

  .note-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-8);
    min-width: 0;
  }

  .note {
    flex: none;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4);
  }

  .explainer-toggle {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    font: var(--weight-semibold) var(--text-md) / 1.5 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .chevron {
    width: 13px;
    height: 13px;
    background: var(--accent);
    mask: var(--icon-chevron-right) center/contain no-repeat;
    transform: rotate(90deg);
    transition: transform 160ms var(--ease-out);
  }

  .chevron.open {
    transform: rotate(-90deg);
  }

  .explainer {
    padding: var(--space-14) var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .explainer a {
    color: var(--accent);
    text-decoration: none;
  }

  .regenerated {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
    padding: var(--space-12) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--category-b-soft);
    box-shadow: inset 0 0 0 1px var(--status-online);
  }

  .regenerated-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: var(--status-online);
    mask: var(--icon-check) center/contain no-repeat;
  }

  .regenerated-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-medium) var(--text-md) / 1.45 var(--font-sans);
    color: var(--ink);
    text-wrap: pretty;
  }

  .url-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    min-width: 0;
    padding: var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--field);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .url-head {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-width: 0;
  }

  .copy-hint {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4);
  }

  .url {
    font: var(--weight-regular) var(--text-sm) / 1.55 var(--font-mono);
    color: var(--ink-2);
    word-break: break-all;
    cursor: pointer;
  }

  .url.struck {
    color: var(--ink-4);
    text-decoration: line-through;
    cursor: auto;
  }

  .regen-row {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-width: 0;
    padding-inline: var(--space-2);
  }

  .regen-note {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4);
    text-wrap: pretty;
  }

  .regen {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-8) var(--space-12);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--status-chit);
    cursor: pointer;
    user-select: none;
  }

  .regen:hover {
    background: var(--status-chit-soft);
  }

  .regen-icon {
    flex: none;
    width: 14px;
    height: 14px;
    background: var(--status-chit);
    mask: var(--icon-refresh) center/contain no-repeat;
  }

  .regen-label {
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--status-chit);
  }

  .old-url {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    padding: var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
  }

  .after,
  .warning {
    display: flex;
    gap: var(--space-10);
    padding: var(--space-16);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
  }

  .after {
    border: 1px dashed var(--line-2);
  }

  .after-icon,
  .warning-icon {
    flex: none;
    width: 16px;
    height: 16px;
    margin-block-start: 2px;
  }

  .after-icon {
    background: var(--ink-4);
    mask: var(--icon-copy) center/contain no-repeat;
  }

  .after-text,
  .warning-text {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .warning {
    padding: var(--space-14) var(--space-16);
    background: var(--status-chit-soft);
    box-shadow: inset 0 0 0 1px var(--status-chit);
  }

  .warning-icon {
    background: var(--status-chit);
    mask: var(--icon-warning) center/contain no-repeat;
  }

  .warning-text {
    color: var(--ink-2);
  }

  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: var(--space-16) var(--space-26);
    border-block-start: 1px solid var(--line-1);
  }

  .secondary {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--accent);
    cursor: pointer;
    user-select: none;
  }

  .secondary:hover {
    background: var(--accent-soft);
  }

  .danger-link {
    flex: none;
    padding: var(--space-10) var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--status-danger);
    cursor: pointer;
    user-select: none;
  }

  .danger-link:hover {
    background: var(--btn-danger-bg);
  }

  .spacer {
    flex: 1;
  }

  .primary {
    --primary-ink: var(--ink-4);
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
    padding: 0 var(--space-18);
    height: var(--control-lg);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--primary-ink);
    cursor: not-allowed;
    user-select: none;
  }

  .primary.ready {
    --primary-ink: var(--on-accent);
    background: var(--accent);
    cursor: pointer;
  }

  .primary.warn {
    --primary-ink: #2a1600;
    background: var(--status-chit);
  }

  .primary:hover {
    filter: brightness(1.08);
  }

  .primary-icon {
    width: 16px;
    height: 16px;
    background: var(--primary-ink);
  }
</style>
