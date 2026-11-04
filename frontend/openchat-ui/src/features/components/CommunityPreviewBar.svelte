<!-- Replaces the composer while a signed-in user or a guest previews a community they haven't joined: "You're previewing
     {name}", a hint, Back (to Explore) and Join. state: preview (Join community) | gated (Review and join, which opens the
     requirements checklist) | guest (Sign in to join). By hand: `avatarUrl` over the gradient, `busy` (a join on its way:
     a spinner in Join, which takes no clicks) and `joinDisabled` (nothing to join, e.g. a locked community). -->
<script lang="ts">
  import { useT } from '../../lib/i18n';
  import { cssUrl } from '../../lib/cssUrl';
  import Spinner from '../../lib/components/Spinner.svelte';

  interface Props {
    /** The community's name (or a group's, previewed the same way). */
    community: string;
    /** The avatar square's background, e.g. a gradient; the accent's gradient without it. */
    grad?: string;
    /** The community's avatar image, shown over `grad`. */
    avatarUrl?: string;
    state?: 'preview' | 'gated' | 'guest';
    /** gated: how many requirements joining has (the hint says so). */
    requirements?: number;
    /** Resource key (or literal text) in place of the state's hint. */
    hint?: string;
    /** Resource key (or literal text) in place of the state's Join label. */
    joinLabel?: string;
    /** Resource key (or literal text); "Back to Explore" without it. */
    backLabel?: string;
    /** Back shows when there's an `onBack`, or while this isn't false. */
    showBack?: boolean;
    /** A join on its way: Join shows a spinner and takes no clicks. */
    busy?: boolean;
    /** Join shows, but can't be pressed (e.g. a locked community). */
    joinDisabled?: boolean;
    onBack?: () => void;
    onJoin?: () => void;
  }

  let {
    community,
    grad,
    avatarUrl,
    state = 'preview',
    requirements = 0,
    hint,
    joinLabel,
    backLabel,
    showBack = true,
    busy = false,
    joinDisabled = false,
    onBack,
    onJoin,
  }: Props = $props();
  const t = useT();

  const gated = $derived(state === 'gated');
  const hasBack = $derived(onBack !== undefined || showBack);
  const hintText = $derived(
    hint ??
      (state === 'guest'
        ? 'ui.communityPreviewBar.hintGuest'
        : gated
          ? t('ui.communityPreviewBar.hintGated', { count: requirements })
          : 'ui.communityPreviewBar.hintPreview'),
  );
  const joinText = $derived(
    joinLabel ??
      (state === 'guest' ? 'ui.communityPreviewBar.signInToJoin' : gated ? 'ui.communityPreviewBar.reviewAndJoin' : 'ui.communityPreviewBar.join'),
  );
  const avatar = $derived(avatarUrl ? `center/cover no-repeat ${cssUrl(avatarUrl)}` : grad);
  const joinOff = $derived(busy || joinDisabled);

  function join() {
    if (!joinOff) onJoin?.();
  }
</script>

<div class="bar" role="region" aria-label={t('ui.communityPreviewBar.region', { name: community })}>
  <span class="avatar" style:background={avatar} aria-hidden="true"></span>
  <div class="text">
    <span class="title">{t('ui.communityPreviewBar.title', { name: community })}</span>
    <span class="hint">{t(hintText)}</span>
  </div>
  <div class="actions">
    {#if hasBack}
      <button type="button" class="back" onclick={() => onBack?.()}>
        <span class="chevron" aria-hidden="true"></span>{t(backLabel ?? 'ui.communityPreviewBar.back')}
      </button>
    {/if}
    <button type="button" class="join" class:off={joinOff} class:busy aria-disabled={joinOff} aria-busy={busy} onclick={join}>
      {#if busy}
        <Spinner size={14} tone="ink" label="ui.communityPreviewBar.joining" />
      {:else if gated}
        <span class="lock" aria-hidden="true"></span>
      {/if}
      {t(joinText)}
    </button>
  </div>
</div>

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

  .bar {
    flex: none;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-14);
    margin: 0 var(--space-14) var(--space-14);
    padding: var(--space-14) var(--space-16);
    border-radius: var(--radius-lg);
    background: color-mix(in oklch, var(--accent) 8%, var(--surface-2));
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 26%, transparent);
  }

  .avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: linear-gradient(140deg, var(--accent-bright), var(--accent));
  }

  .text {
    flex: 1 1 220px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    font: var(--weight-semibold) var(--text-base) / 1.3 var(--font-sans);
    color: var(--ink);
  }

  .hint {
    font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .actions {
    flex: none;
    display: flex;
    gap: var(--space-8);
  }

  .back,
  .join {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    height: 38px;
    margin: 0;
    border: none;
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;

    &:focus-visible {
      @include focus-ring;
    }
  }

  .back {
    padding: 0 var(--space-14);
    background: transparent;
    color: var(--ink-2);

    &:hover {
      background: var(--overlay-2);
    }
  }

  .chevron {
    @include icon(chevron-right, 15px);
    transform: rotate(180deg);
  }

  .join {
    padding: 0 var(--space-18);
    background: var(--accent);
    color: var(--on-accent);

    &:hover:not(.off) {
      filter: brightness(1.08);
    }

    &.off {
      cursor: not-allowed;
    }

    &.off:not(.busy) {
      background: var(--overlay-2);
      color: var(--ink-4);
    }

    &.busy {
      cursor: progress;
    }
  }

  .lock {
    @include icon(lock, 14px);
  }
</style>
