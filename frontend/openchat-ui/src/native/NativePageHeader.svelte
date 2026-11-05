<!-- Native page header (native design notes §1, §2): back, a title or an avatar + name + sub line, and trailing icon
     buttons in touch-target cells (44pt iOS, 48dp Android). Back is a chevron on iOS and an arrow on Android, the
     kebab horizontal dots on iOS and vertical on Android (both from the root's data-os). It pads the top by the safe
     area. size="lg" is a tab root's title row ("Chats": 21px extra-bold, no back). With an avatar it's the
     conversation's header: the avatar, name and sub line open the details (onTitleClick), and `divider` draws the
     hairline the messages scroll under. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../lib/i18n';
  import type { NativeHeaderAction } from './types';

  interface Props {
    /** Resource key (or literal text): the page title, or the name beside the avatar. */
    title: string;
    /** Resource key (or literal text): the line under the name (a status, a member count). */
    sub?: string;
    /** md: a pushed page's 17px title. lg: a tab root's 21px title, without back. */
    size?: 'md' | 'lg';
    /** The avatar before the name (the conversation's header): an Avatar or TokenAvatar, about 36px. */
    avatar?: Snippet;
    onBack?: () => void;
    /** Resource key (or literal text). */
    backLabel?: string;
    /** Makes the title (with its avatar and sub line) a button: the conversation's details. */
    onTitleClick?: () => void;
    /** Resource key (or literal text): the title button's accessible name, when it says more than the title. */
    titleLabel?: string;
    /** Trailing icon buttons, before the kebab. */
    actions?: NativeHeaderAction[];
    /** Shows the kebab last; gets the button, to anchor a menu to. */
    onMore?: (anchor: HTMLElement) => void;
    /** Resource key (or literal text). */
    moreLabel?: string;
    /** A hairline under the header. */
    divider?: boolean;
    /** Trailing content before the icon buttons (a custom button, a badge). */
    children?: Snippet;
  }

  let {
    title, sub = '', size = 'md', avatar, onBack, backLabel = 'ui.common.back', onTitleClick, titleLabel = '', actions = [],
    onMore, moreLabel = 'ui.common.moreOptions', divider = false, children,
  }: Props = $props();
  const t = useT();

  const back = $derived(size === 'md' ? onBack : undefined);
</script>

{#snippet heading()}
  {#if avatar}{@render avatar()}{/if}
  <span class="text">
    <span class="title">{t(title)}</span>
    {#if sub}<span class="sub">{t(sub)}</span>{/if}
  </span>
{/snippet}

<header class="header {size}" class:person={!!avatar} class:no-back={!back} class:divider>
  {#if back}
    <button type="button" class="cell" aria-label={t(backLabel)} onclick={back}><span class="back-icon"></span></button>
  {/if}
  {#if onTitleClick}
    <button type="button" class="heading" aria-label={titleLabel ? t(titleLabel) : undefined} onclick={onTitleClick}>{@render heading()}</button>
  {:else}
    <div class="heading">{@render heading()}</div>
  {/if}
  {#if children}{@render children()}{/if}
  {#each actions as action (action.icon + action.label)}
    <button type="button" class="cell" aria-label={t(action.label)} onclick={(e) => action.onClick(e.currentTarget)}>
      <span class="action-icon" style:mask="var(--icon-{action.icon}) center/contain no-repeat"></span>
    </button>
  {/each}
  {#if onMore}
    <button type="button" class="cell" aria-label={t(moreLabel)} aria-haspopup="menu" onclick={(e) => onMore(e.currentTarget)}><span class="more-icon"></span></button>
  {/if}
</header>

<style lang="scss">
  @use '../lib/styles/mixins' as *;

  .header {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: var(--safe-top) 8px 6px 4px;
    color: var(--ink);

    &.no-back {
      padding-inline-start: 16px;
    }

    // a tab root: the title row under the status bar
    &.lg {
      gap: 4px;
      padding: calc(var(--safe-top) + 8px) 8px 0 20px;
    }

    // the conversation's header
    &.person {
      gap: 2px;
      padding: var(--safe-top) 2px 8px 4px;
    }

    &.divider {
      box-shadow: inset 0 -1px 0 var(--line-1);
    }
  }

  .cell {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    @include flex-center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-circle);
    background: none;
    color: var(--ink);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  // back: a chevron on iOS, an arrow on Android; both point against the reading direction
  .back-icon {
    @include icon(chevron-right, 22px);
    transform: rotate(180deg);

    &:dir(rtl) {
      transform: none;
    }

    :global([data-os='android']) & {
      mask: var(--icon-back) center/contain no-repeat;
      transform: none;

      &:dir(rtl) {
        transform: scaleX(-1);
      }
    }
  }

  .action-icon {
    width: 22px;
    height: 22px;
    background: currentColor;
  }

  // kebab: horizontal dots on iOS, vertical on Android
  .more-icon {
    @include icon(more, 20px);

    :global([data-os='android']) & {
      mask: var(--icon-kebab) center/contain no-repeat;
    }
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;

    &:is(button) {
      cursor: pointer;
    }
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .title {
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    @include truncate;

    .lg & {
      font: 800 text-size(21px) / 1.15 var(--font-sans);
      letter-spacing: -0.01em;
    }

    .person & {
      font: var(--weight-bold) var(--text-lg) / 1.2 var(--font-sans);
    }
  }

  .sub {
    font: var(--weight-medium) text-size(12px) / 1.2 var(--font-sans);
    color: var(--ink-4);
    @include truncate;
  }
</style>
