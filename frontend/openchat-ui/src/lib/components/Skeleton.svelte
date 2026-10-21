<!-- Loading placeholder rows shaped like the real lists. Soft shimmer (tokens: --skeleton-base/--skeleton-sheen,
     keyframes oc-shimmer in tokens.css; stops under prefers-reduced-motion). Announces once as "Loading …".
     variant: chat | token | activity | member. -->
<script lang="ts">
  import { useT } from '../i18n';
  type Variant = 'chat' | 'token' | 'activity' | 'member';

  const LABELS: Record<Variant, string> = {
    chat: 'ui.skeleton.loadingChats',
    token: 'ui.skeleton.loadingTokens',
    activity: 'ui.skeleton.loadingActivity',
    member: 'ui.skeleton.loadingMembers',
  };
  // fixed, varied widths so rows don't look stamped; deterministic so nothing jumps between renders
  const W1 = ['46%', '62%', '38%', '54%', '70%', '42%', '58%', '50%'];
  const W2 = ['78%', '64%', '84%', '56%', '72%', '88%', '60%', '68%'];

  interface Props {
    variant?: Variant;
    count?: number;
    /** Overrides the announced label. */
    /** Resource key (or literal text) for the accessible name; defaults per variant. */
    label?: string;
  }

  let { variant = 'chat', count = 6, label = '' }: Props = $props();
  const t = useT();
</script>

<div class="skeleton {variant}" role="status" aria-live="polite" aria-busy="true" aria-label={t(label || LABELS[variant])}>
  {#each { length: count } as _, i}
    <div class="row" style:--row-delay="{i * 90}ms" aria-hidden="true">
      <span class="shim avatar"></span>
      <span class="lines">
        <span class="shim line1" style:width={W1[i % W1.length]}></span>
        <span class="shim line2" style:width={W2[i % W2.length]}></span>
        {#if variant === 'token'}<span class="bar" style:width={W1[(i + 3) % W1.length]}></span>{/if}
      </span>
      {#if variant !== 'member'}
        <span class="meta">
          <span class="shim meta1"></span>
          {#if variant === 'chat' || variant === 'token'}<span class="meta2"></span>{/if}
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 0 var(--space-10);
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background: transparent;
  }

  .shim {
    background: var(--skeleton-base);
    background-image: var(--skeleton-sheen);
    background-size: 200% 100%;
    animation: oc-shimmer 1.4s ease-in-out infinite;
    animation-delay: var(--row-delay);
  }

  .avatar {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
  }

  .lines {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .line1 {
    height: 11px;
    border-radius: 6px;
  }

  .line2 {
    height: 9px;
    border-radius: 5px;
  }

  .bar {
    height: 3px;
    border-radius: 2px;
    background: var(--skeleton-base);
  }

  .meta {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .meta1 {
    width: 34px;
    height: 10px;
    border-radius: 5px;
  }

  .meta2 {
    width: 28px;
    height: 9px;
    border-radius: 5px;
    background: var(--skeleton-base);
  }

  .token {
    gap: 8px;
  }

  .token .row {
    gap: 14px;
    min-height: 68px;
    padding: var(--space-12) var(--space-14);
    background: var(--overlay-1);
  }

  .token .avatar {
    width: 40px;
    height: 40px;
  }

  .token .meta1 {
    width: 56px;
  }

  .activity .row {
    min-height: 56px;
    padding: 0 var(--space-8);
  }

  .activity .avatar {
    width: 40px;
    height: 40px;
  }

  .member {
    gap: 2px;
  }

  .member .row {
    min-height: 52px;
    padding: 0 var(--space-8);
  }

  .member .avatar {
    width: 36px;
    height: 36px;
  }
</style>
