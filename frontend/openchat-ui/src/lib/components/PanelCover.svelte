<!-- Cover band at the top of a side panel, with square icon actions pinned to its leading and trailing corners. -->
<script lang="ts">
  const MASKS = {
    favourite: 'var(--icon-heart) center/contain no-repeat',
    close: 'var(--icon-close) center/contain no-repeat',
    share: 'var(--icon-share) center/contain no-repeat',
    edit: 'var(--icon-edit) center/contain no-repeat',
    manage: 'var(--icon-manage) center/contain no-repeat',
    info: 'var(--icon-info) center/contain no-repeat',
    more: 'var(--icon-more) center/contain no-repeat',
    invite: 'var(--icon-invite) center/contain no-repeat',
  };

  type Action = keyof typeof MASKS;

  interface Props {
    /** CSS background; a striped placeholder when empty. */
    cover?: string;
    /** Leading-corner actions. */
    actions?: Action[];
    /** Trailing-corner actions. */
    trailActions?: Action[];
    /** Click handler per action key. */
    handlers?: Partial<Record<Action, () => void>>;
  }

  let { cover = '', actions = ['close'], trailActions = [], handlers = {} }: Props = $props();
</script>

{#snippet group(names: Action[], side: 'lead' | 'trail')}
  <div class="actions {side}">
    {#each names as name}
      <div class="action" onclick={handlers[name]} role="button" tabindex="0">
        <span class="icon" style:mask={MASKS[name] ?? MASKS.close}></span>
      </div>
    {/each}
  </div>
{/snippet}

<div class="cover" style:background={cover || 'repeating-linear-gradient(115deg,#1d1424 0 10px,#241a2d 10px 20px)'}>
  {@render group(actions, 'lead')}
  {@render group(trailActions, 'trail')}
</div>

<style>
  .cover {
    position: relative;
    height: 118px;
    flex: none;
    margin: var(--space-8) var(--space-8) 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .actions {
    position: absolute;
    top: var(--space-8);
    display: flex;
    gap: var(--space-6);
  }

  .lead {
    inset-inline-start: var(--space-8);
  }

  .trail {
    inset-inline-end: var(--space-8);
  }

  .action {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    background: var(--card-2, #1b1b21);
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .action:hover {
    background: var(--btn-hover, rgba(255, 255, 255, 0.1));
  }

  .icon {
    width: 16px;
    height: 16px;
    background: var(--ink-3, #9a9aa8);
  }
</style>
