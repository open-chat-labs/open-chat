<!-- Manage: one dialog for a group's, channel's or community's settings and running, with a nav down the
     side (General, then Advanced) and the open page beside it. The host renders the page (GroupSettingsDialog,
     InviteDialog or GroupPanel, each `embedded`, with its own title bar and close button) as children.
     The nav's head shows the chat (avatar, name, a subtitle) and, with onBack, a back arrow (a channel back to its
     community). The footer holds one danger action: Delete for the owner, Leave for anyone else.
     confirming shows "Discard changes?" over the page; the host decides when (unsaved edits) and what happens next.
     The veil and Esc call onClose (Esc keeps editing while confirming). Built by hand from the App prototype's
     Manage dialog: the design export has no component for it. -->
<script lang="ts" module>
  export interface ManageNavItem {
    key: string;
    /** Resource key (or literal text). */
    label: string;
    /** One of the design's nav icons: main, members, invite, channels, usergroups, rules, stats, permissions, gates,
     *  bots, webhooks, convert, import. */
    icon: string;
  }

  export interface ManageNavGroup {
    /** Resource key (or literal text), e.g. 'ui.manageDialog.general'. */
    label: string;
    items: ManageNavItem[];
  }

  const NAV_ICONS: Record<string, string> = {
    main: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%2F%3E%3Cpath%20d%3D%22M12%2016v-4%22%2F%3E%3Cpath%20d%3D%22M12%208h.01%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    members: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M22%2021v-2a4%204%200%200%200-3-3.87%22%2F%3E%3Cpath%20d%3D%22M16%203.13a4%204%200%200%201%200%207.75%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    invite: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M19%208v6%22%2F%3E%3Cpath%20d%3D%22M22%2011h-6%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    channels: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%209h16%22%2F%3E%3Cpath%20d%3D%22M4%2015h16%22%2F%3E%3Cpath%20d%3D%22M10%203%208%2021%22%2F%3E%3Cpath%20d%3D%22M16%203l-2%2018%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    usergroups: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%223%22%2F%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%228%22%20r%3D%223%22%2F%3E%3Cpath%20d%3D%22M2%2020a6%206%200%200%201%2012%200%22%2F%3E%3Cpath%20d%3D%22M14%2014.5a6%206%200%200%201%208%205.5%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    rules: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M14%203H6a2%202%200%200%200-2%202v14a2%202%200%200%200%202%202h12a2%202%200%200%200%202-2V9z%22%2F%3E%3Cpath%20d%3D%22M14%203v6h6%22%2F%3E%3Cpath%20d%3D%22M8%2013h8%22%2F%3E%3Cpath%20d%3D%22M8%2017h5%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    stats: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%203v16a2%202%200%200%200%202%202h16%22%2F%3E%3Cpath%20d%3D%22M18%2017V9%22%2F%3E%3Cpath%20d%3D%22M13%2017V5%22%2F%3E%3Cpath%20d%3D%22M8%2017v-3%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    permissions: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2022s8-4%208-10V5l-8-3-8%203v7c0%206%208%2010%208%2010z%22%2F%3E%3Cpath%20d%3D%22m9%2012%202%202%204-4%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    gates: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%224%22%20y%3D%2211%22%20width%3D%2216%22%20height%3D%2210%22%20rx%3D%222%22%2F%3E%3Cpath%20d%3D%22M8%2011V7a4%204%200%200%201%208%200v4%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    bots: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%226%22%20width%3D%2218%22%20height%3D%2214%22%20rx%3D%224%22%2F%3E%3Cpath%20d%3D%22M9%2012h.01%22%2F%3E%3Cpath%20d%3D%22M15%2012h.01%22%2F%3E%3Cpath%20d%3D%22M9.5%2016h5%22%2F%3E%3Cpath%20d%3D%22M12%202v4%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    webhooks: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M18%2016.98h-5.99c-1.1%200-1.95.94-2.48%201.9A4%204%200%200%201%202%2017c.01-.7.2-1.4.57-2%22%2F%3E%3Cpath%20d%3D%22m6%2017%203.13-5.78c.53-.97.1-2.18-.5-3.1a4%204%200%201%201%206.89-4.06%22%2F%3E%3Cpath%20d%3D%22m12%206%203.13%205.73C15.66%2012.7%2016.9%2013%2018%2013a4%204%200%200%201%200%208%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    convert: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M18%2021a8%208%200%200%200-16%200%22%2F%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%228%22%20r%3D%225%22%2F%3E%3Cpath%20d%3D%22M22%2020c0-3.37-2-6.5-4-8a5%205%200%200%200-.45-8.3%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
    import: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%203v12%22%2F%3E%3Cpath%20d%3D%22m8%2011%204%204%204-4%22%2F%3E%3Cpath%20d%3D%22M8%205H5a2%202%200%200%200-2%202v10a2%202%200%200%200%202%202h14a2%202%200%200%200%202-2V7a2%202%200%200%200-2-2h-3%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat',
  };
  const EXIT_MASK = 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M9%2021H5a2%202%200%200%201-2-2V5a2%202%200%200%201%202-2h4%22%2F%3E%3Cpath%20d%3D%22m16%2017%205-5-5-5%22%2F%3E%3Cpath%20d%3D%22M21%2012H9%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat';
  const TRASH_MASK = 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%206h18%22%2F%3E%3Cpath%20d%3D%22M19%206v14a2%202%200%200%201-2%202H7a2%202%200%200%201-2-2V6%22%2F%3E%3Cpath%20d%3D%22M8%206V4a2%202%200%200%201%202-2h4a2%202%200%200%201%202%202v2%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat';
  const BACK_MASK = 'var(--icon-back) center/contain no-repeat';

  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#8B7BFF,#5B3FD9)',
    rose: 'linear-gradient(140deg,#FF8FA8,#E0456A)',
    blue: 'linear-gradient(140deg,#5CB8FF,#2F6BFF)',
    amber: 'linear-gradient(140deg,#FFC061,#F58A2E)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FA6B8)',
    plum: 'linear-gradient(140deg,#E27BFF,#9B3FD9)',
    slate: 'linear-gradient(140deg,#9AA3B5,#5D6678)',
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useT } from '../../lib/i18n';
  import { modal } from '../../lib/behaviours/modal';
  import { cssUrl } from '../../lib/cssUrl';

  interface Props {
    /** The chat's or community's name. */
    title: string;
    /** Resource key (or literal text) under the name, e.g. "Public group · 1,204 members". */
    subtitle?: string;
    /** Avatar gradient (violet | rose | blue | amber | teal | plum | slate) when there's no image. */
    color?: string;
    avatarUrl?: string;
    /** A channel's avatar is round. */
    round?: boolean;
    /** Resource key (or literal text) for the back arrow's title. */
    backLabel?: string;
    /** Shows a back arrow in the nav's head (a channel back to its community). */
    onBack?: () => void;
    nav: ManageNavGroup[];
    /** The open page's key. */
    current: string;
    onSelect: (key: string) => void;
    /** The footer's danger action: "Delete <noun>" for the owner, "Leave <noun>" for anyone else. */
    danger?: { kind: 'delete' | 'leave'; noun: 'group' | 'channel' | 'community'; onPress: () => void };
    /** Shows "Discard changes?" over the page. */
    confirming?: boolean;
    onKeepEditing?: () => void;
    onDiscard?: () => void;
    onClose: () => void;
    children?: Snippet;
  }

  let { title, subtitle = '', color = 'teal', avatarUrl, round = false, backLabel = '', onBack, nav, current, onSelect, danger, confirming = false, onKeepEditing, onDiscard, onClose, children }: Props = $props();
  const t = useT();

  const keys = (fn?: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn?.();
    }
  };
</script>

<div class="layer oc-dialog-layer" data-screen-label="Manage dialog" role="presentation" use:modal={confirming ? onKeepEditing : onClose}>
  <div class="oc-veil" onclick={onClose} aria-hidden="true"></div>
  <div class="card" role="dialog" aria-modal="true" aria-label={title}>
    <nav class="nav">
      <div class="nav-head">
        {#if onBack}
          <span class="back" onclick={onBack} onkeydown={keys(onBack)} title={t(backLabel)} aria-label={t(backLabel)} role="button" tabindex="0"><span class="back-icon" data-oc-flip style:mask={BACK_MASK}></span></span>
        {/if}
        <span class="avatar" class:round style:background={avatarUrl ? `${cssUrl(avatarUrl)} center/cover no-repeat` : (GRADIENTS[color] ?? GRADIENTS.teal)}></span>
        <div class="names">
          <span class="name">{title}</span>
          {#if subtitle}<span class="sub">{t(subtitle)}</span>{/if}
        </div>
      </div>
      <div class="groups">
        {#each nav as group (group.label)}
          <div class="group">
            <span class="group-label">{t(group.label)}</span>
            {#each group.items as item (item.key)}
              {@const on = item.key === current}
              <div class="item" class:on onclick={() => onSelect(item.key)} onkeydown={keys(() => onSelect(item.key))} role="button" tabindex="0" aria-current={on ? 'page' : undefined}>
                <span class="item-icon" style:mask={NAV_ICONS[item.icon] ?? NAV_ICONS.main}></span>
                <span class="item-label">{t(item.label)}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
      {#if danger}
        <div class="foot">
          <div class="danger" onclick={danger.onPress} onkeydown={keys(danger.onPress)} role="button" tabindex="0">
            <span class="danger-icon" style:mask={danger.kind === 'delete' ? TRASH_MASK : EXIT_MASK}></span>
            <span class="danger-label">{t(`ui.manageDialog.${danger.kind}`, { noun: danger.noun })}</span>
          </div>
        </div>
      {/if}
    </nav>
    <div class="page">
      {@render children?.()}
    </div>
  </div>
  {#if confirming}
    <div class="confirm-layer">
      <div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="oc-manage-discard">
        <div class="confirm-text">
          <span class="confirm-title" id="oc-manage-discard">{t('ui.manageDialog.discardTitle')}</span>
          <span class="confirm-body">{t('ui.manageDialog.discardBody')}</span>
        </div>
        <div class="confirm-actions">
          <div class="keep" onclick={onKeepEditing} onkeydown={keys(onKeepEditing)} role="button" tabindex="0">{t('ui.manageDialog.keepEditing')}</div>
          <div class="discard" onclick={onDiscard} onkeydown={keys(onDiscard)} role="button" tabindex="0">{t('ui.manageDialog.discard')}</div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .layer {
    z-index: 65;
    padding: var(--space-24);
    box-sizing: border-box;
  }

  .card {
    position: relative;
    width: min(1040px, 100%);
    height: min(760px, 100%);
    display: flex;
    overflow: hidden;
    border-radius: var(--radius-2xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .nav {
    flex: none;
    width: 250px;
    display: flex;
    flex-direction: column;
    background: var(--surface-0);
    border-inline-end: 1px solid var(--line-1);
  }

  .nav-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: 71px;
    box-sizing: border-box;
    padding: 0 var(--space-14);
    border-bottom: 1px solid var(--line-1);
  }

  .back {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-inline-start: -4px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .back:hover {
    background: var(--overlay-2);
  }

  .back-icon {
    width: 17px;
    height: 17px;
    background: var(--ink-2);
  }

  .avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .avatar.round {
    border-radius: 50%;
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .name,
  .sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name {
    font: var(--weight-bold) var(--text-base) / 1.2 var(--font-sans);
    color: var(--ink);
  }

  .sub {
    font: var(--weight-regular) var(--text-sm) / 1.2 var(--font-sans);
    color: var(--ink-3);
  }

  .groups {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 10px 12px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-label {
    padding: 6px 10px;
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-sans);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    color: var(--ink-2);
    font-weight: var(--weight-medium);
    cursor: pointer;
    user-select: none;
  }

  .item:hover {
    background: var(--overlay-1);
  }

  .item.on {
    background: var(--overlay-2);
    color: var(--ink);
    font-weight: var(--weight-semibold);
  }

  .item-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: currentColor;
  }

  .item-label {
    flex: 1;
    min-width: 0;
    font-size: var(--text-md);
    line-height: 1;
    font-family: var(--font-sans);
  }

  .foot {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-16) 10px;
    border-top: 1px solid var(--line-1);
  }

  .danger {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    height: var(--control-lg);
    box-sizing: border-box;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    font: var(--weight-medium) var(--text-md) / 1 var(--font-sans);
    color: var(--status-danger);
    cursor: pointer;
    user-select: none;
  }

  .danger:hover {
    background: var(--btn-danger-bg);
  }

  .danger-icon {
    flex: none;
    width: 15px;
    height: 15px;
    background: var(--status-danger);
  }

  .danger-label {
    flex: 1;
    min-width: 0;
  }

  .page {
    position: relative;
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
  }

  .confirm-layer {
    position: fixed;
    inset: 0;
    z-index: 68;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-24);
    background: rgba(3, 3, 6, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .confirm {
    width: min(380px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--space-16);
    padding: var(--space-22);
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
  }

  .confirm-text {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .confirm-title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink);
  }

  .confirm-body {
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-3);
    text-wrap: pretty;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-8);
  }

  .keep,
  .discard {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 var(--space-14);
    border-radius: var(--radius-md);
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    cursor: pointer;
    user-select: none;
  }

  .keep {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .keep:hover {
    background: var(--btn-hover);
  }

  .discard {
    background: var(--status-danger);
    color: #fff;
  }

  .discard:hover {
    filter: brightness(1.08);
  }

  @media (max-width: 767px) {
    .layer {
      padding: 0;
    }

    .card {
      width: 100%;
      height: 100%;
      border-radius: 0;
    }

    .nav {
      width: 200px;
    }
  }
</style>
