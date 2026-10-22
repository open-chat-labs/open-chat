<!-- Header for workspace pages (wallet token page, Send, Receive, Swap): back · optional 28px token avatar · title · trailing slot.
     Trailing content (steps, balance) is passed as children. -->
<script lang="ts">
  import { useT } from '../i18n';
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import TokenAvatar from './TokenAvatar.svelte';

  interface Props {
    /** Resource key (or literal text). */
    title: string;
    /** Resource key (or literal text) for the back button's accessible name. */
    backLabel?: string;
    avatarMark?: string;
    avatarGradient?: string;
    onBack?: () => void;
    children?: Snippet;
  }

  let { title, backLabel = 'ui.common.back', avatarMark, avatarGradient, onBack, children }: Props = $props();
  const t = useT();
</script>

<div class="page-header" class:has-back={!!onBack}>
  {#if onBack}
    <div class="back"><IconButton label={backLabel} variant="ghost" icon="back" onClick={onBack} /></div>
  {/if}
  {#if avatarMark}
    <TokenAvatar size={28} mark={avatarMark} gradient={avatarGradient} />
  {/if}
  <span class="title">{t(title)}</span>
  {#if children}
    <div class="trailing">{@render children()}</div>
  {/if}
</div>

<style>
  .page-header {
    flex: none;
    width: 100%;
    height: var(--header-h, 66px);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    padding: 0 var(--space-24);
    border-bottom: 1px solid var(--line-1);
  }

  .has-back {
    padding-left: var(--space-14);
  }

  .back {
    flex: none;
    display: flex;
  }

  .title {
    flex: 1;
    min-width: 0;
    font: var(--weight-bold) var(--text-lg) / 1 var(--font-sans);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trailing {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
</style>
