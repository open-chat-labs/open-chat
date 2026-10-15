<!-- "Ways to earn CHIT": a "next up" trio (one quick win, one middling task, one referral) and every achievement
     by group, with progress per group (groups the catalogue has nothing for are left out, except Partners).
     The catalogue, rewards and done flags come from `achievements`; `unlocked`
     (achievement ids) marks achievements earned this session as done;
     `highlight` opens that row's group, marks the row and scrolls it into view. -->
<script lang="ts" module>
  export type AchievementBand = 'quick' | 'mid' | 'big';
  export interface Achievement {
    id: string;
    /** messaging | … (one of the dialog's groups). */
    group: string;
    reward: number;
    done: boolean;
    /** Tags what the "next up" trio draws from. */
    band?: AchievementBand;
    icon?: string;
    /** Resource key (or literal text); defaults to ui.achievementsDialog.achievements.<id>. */
    label?: string;
  }
</script>

<script lang="ts">
  import { getI18n, useT } from '../../lib/i18n';
  import { onMount } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  const i18n = getI18n(); // number formatting follows the host locale

  type Band = AchievementBand;

  // group metadata stays here; the achievements themselves (ids, rewards, done) come from the host
  const GROUPS: { key: string; label: string; icon: string; ink: string }[] = [
    { key: 'messaging', label: 'ui.achievementsDialog.groups.messaging', icon: 'chat', ink: 'var(--status-chit,#FF9F45)' },
    { key: 'profile', label: 'ui.achievementsDialog.groups.profile', icon: 'user', ink: 'var(--accent,#FF5672)' },
    { key: 'wallet', label: 'ui.achievementsDialog.groups.wallet', icon: 'wallet', ink: 'var(--status-verified,#3D9BFF)' },
    { key: 'community', label: 'ui.achievementsDialog.groups.community', icon: 'users', ink: 'var(--status-online,#2EE6A8)' },
    { key: 'streaks', label: 'ui.achievementsDialog.groups.streaks', icon: 'flame', ink: 'var(--status-chit,#FF9F45)' },
    { key: 'referrals', label: 'ui.achievementsDialog.groups.referrals', icon: 'users', ink: 'var(--ink-3,#9A9AA8)' },
    { key: 'partners', label: 'ui.achievementsDialog.groups.partners', icon: 'link', ink: 'var(--ink-4,#7C7C8C)' },
  ];

  const fmt = (n: number) => n.toLocaleString(i18n.locale ?? 'en');
  const achievement = (id: string) => 'ui.achievementsDialog.achievements.' + id;

  interface Props {
    /** Every achievement with its reward and whether it's done. */
    achievements: Achievement[];
    /** Ids of achievements earned this session (e.g. 'tipAMessage'). */
    unlocked?: string[];
    /** Id of the achievement just earned. */
    highlight?: string;
    /** Defaults to onClose. */
    onBack?: () => void;
    onClose?: () => void;
  }

  let { achievements, unlocked = [], highlight = '', onBack, onClose }: Props = $props();
  const t = useT();

  // the trio is drawn once per open, so it changes between visits but never shuffles under the reader
  const seed = Math.floor(Math.random() * 997);
  // undefined: follow the highlight; null: all closed; otherwise the open group's key
  let openKey = $state<string | null | undefined>(undefined);
  let scroller: HTMLDivElement;

  const isDone = (label: string, done: boolean) => done || unlocked.includes(label);

  const all = $derived(achievements.map((a) => ({ label: a.id, text: a.label, done: isDone(a.id, a.done), reward: a.reward, band: a.band, icon: a.icon })));
  const left = $derived(all.filter((a) => !a.done));
  const doneCount = $derived(all.length - left.length);
  const earned = $derived(all.filter((a) => a.done).reduce((sum, a) => sum + a.reward, 0));
  const onOffer = $derived(left.reduce((sum, a) => sum + a.reward, 0));

  // one quick win, one middling task, one referral — so the trio always has something doable today and something worth aiming at
  const next = $derived(
    (['quick', 'mid', 'big'] as Band[])
      .map((band, salt) => {
        const pool = left.filter((a) => a.band === band);
        return pool.length ? pool[(seed + salt) % pool.length] : null;
      })
      .filter((a) => a !== null),
  );

  const groups = $derived(
    GROUPS.map((g) => {
      const items = achievements.filter((a) => a.group === g.key);
      const open = openKey === undefined ? !!highlight && items.some((i) => i.id === highlight) : openKey === g.key;
      const gotten = items.filter((i) => isDone(i.id, i.done)).length;
      // the just-earned row leads; then unfinished first: the list should read as work left, then history
      const rows = items
        .map((a) => ({ label: a.id, text: a.label, done: isDone(a.id, a.done), reward: a.reward, hl: a.id === highlight }))
        .sort((a, b) => Number(b.hl) - Number(a.hl) || Number(a.done) - Number(b.done));
      return { ...g, items, open, count: `${gotten} / ${items.length}`, pct: items.length ? Math.round((gotten / items.length) * 100) : 0, rows };
    })
      // a group the host's catalogue has nothing for is left out; Partners stays, its empty line explains third parties
      .filter((g) => g.items.length > 0 || g.key === 'partners'),
  );

  onMount(() => {
    if (!highlight) return;
    // bring the just-earned row into view inside the dialog's own scroller
    const timer = setTimeout(() => {
      const row = scroller.querySelector('[data-ach-hl="1"]');
      if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3;
    }, 120);
    return () => clearTimeout(timer);
  });
</script>

<div class="layer" data-screen-label="Achievements" role="dialog" aria-modal="true" use:modal={() => onClose?.()}>
  <div class="veil" onclick={() => onClose?.()} aria-hidden="true"></div>

  <div class="card">
    <div class="head">
      <span class="icon-button back" onclick={() => (onBack ?? onClose)?.()} role="button" tabindex="0" aria-label={t('ui.achievementsDialog.backToChit')} title={t('ui.achievementsDialog.backToChit')}><span class="back-glyph"></span></span>
      <div class="heading">
        <span class="title">{t('ui.achievementsDialog.title')}</span>
        <span class="subtitle">{t('ui.achievementsDialog.subtitle', { done: doneCount, total: all.length, earned: fmt(earned), onOffer: fmt(onOffer) })}</span>
      </div>
      <span class="icon-button" onclick={() => onClose?.()} role="button" tabindex="0" aria-label={t('ui.common.close')}><span class="close-glyph"></span></span>
    </div>

    <div class="body" bind:this={scroller}>
      {#if next.length > 0}
        <div class="section">
          <span class="caps">{t('ui.achievementsDialog.nextUp')}</span>
          <div class="trio">
            {#each next as item, i}
              <div class="next next-{i}">
                <span class="next-icon" style:mask="var(--icon-{item.icon ?? 'chat'}) center/contain no-repeat"></span>
                <span class="next-label">{t(item.text ?? achievement(item.label))}</span>
                <span class="next-reward">{t('ui.achievementsDialog.reward', { amount: fmt(item.reward) })}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="section groups">
        <span class="caps">{t('ui.achievementsDialog.everythingElse')}</span>
        {#each groups as g}
          <div class="group" class:open={g.open} style:--group-ink={g.ink}>
            <div class="group-head" onclick={() => (openKey = g.open ? null : g.key)} role="button" tabindex="0" aria-expanded={g.open}>
              <span class="group-icon" style:mask="var(--icon-{g.icon}) center/contain no-repeat"></span>
              <div class="group-main">
                <span class="group-label">{t(g.label)}</span>
                <div class="group-bar"><div class="group-fill" style:width="{g.pct}%"></div></div>
              </div>
              <span class="group-count">{g.count}</span>
              <span class="group-chevron"></span>
            </div>
            {#if g.open}
              <div class="rows">
                {#each g.rows as r}
                  <div class="row" class:hl={r.hl} class:done={r.done} data-ach-hl={r.hl ? '1' : '0'}>
                    <span class="mark"><span class="mark-check"></span></span>
                    <span class="row-label">{t(r.text ?? achievement(r.label))}</span>
                    <span class="row-reward">{r.hl ? t('ui.achievementsDialog.justEarned', { amount: fmt(r.reward) }) : r.done ? t('ui.achievementsDialog.earned') : t('ui.achievementsDialog.reward', { amount: fmt(r.reward) })}</span>
                  </div>
                {/each}
                {#if g.items.length === 0 && g.key === 'partners'}
                  <span class="empty">{t('ui.achievementsDialog.partnersEmpty')}</span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .layer {
    position: fixed;
    inset: 0;
    z-index: 73;
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
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 620px;
    height: 760px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1, #0e0e12);
    box-shadow:
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.1)),
      var(--shadow-modal, 0 30px 70px rgba(0, 0, 0, 0.45));
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow, 280ms) var(--ease-out) both;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-12);
    padding: var(--space-24) var(--space-32);
    border-block-end: 1px solid var(--line-1, rgba(255, 255, 255, 0.07));
  }

  .icon-button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
  }

  .icon-button.back {
    width: 32px;
    height: 32px;
    margin-inline-start: -10px;
  }

  .back-glyph {
    width: 16px;
    height: 16px;
    background: var(--ink-2, #c9c9d4);
    mask: var(--icon-back) center/contain no-repeat;
  }

  .close-glyph {
    width: 15px;
    height: 15px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }

  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .title {
    font: var(--weight-bold) var(--text-lg) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .subtitle {
    font: var(--weight-regular) var(--text-sm) / 1.3 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-26);
    padding: var(--space-26) var(--space-32) var(--space-32);
  }

  .section {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
  }

  .section.groups {
    gap: var(--space-8);
  }

  .caps {
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-4, #7c7c8c);
  }

  .trio {
    display: flex;
    gap: var(--space-10);
  }

  .next {
    --next-ink: var(--accent, #ff5672);
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
    padding: var(--space-16) var(--space-14);
    box-sizing: border-box;
    border-radius: var(--radius-lg);
    background: var(--overlay-1, rgba(255, 255, 255, 0.045));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .next-0 {
    background: var(--accent-soft, rgba(255, 86, 114, 0.12));
    box-shadow: inset 0 0 0 1px var(--accent, #ff5672);
  }

  .next-1 {
    --next-ink: var(--status-chit, #ff9f45);
  }

  .next-2 {
    --next-ink: var(--status-online, #2ee6a8);
  }

  .next-icon {
    width: 20px;
    height: 20px;
    background: var(--next-ink);
  }

  .next-label {
    flex: 1;
    font: var(--weight-semibold) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    text-wrap: pretty;
  }

  .next-reward {
    font: var(--weight-bold) var(--text-sm) / 1 var(--font-mono);
    color: var(--next-ink);
  }

  .group {
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-md);
    background: var(--overlay-1, rgba(255, 255, 255, 0.035));
    overflow: hidden;
  }

  .group.open {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
    box-shadow: inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
  }

  .group-head {
    display: flex;
    align-items: center;
    gap: var(--space-12);
    min-height: 52px;
    padding: var(--space-10) var(--space-12);
    box-sizing: border-box;
    cursor: pointer;
  }

  .group-head:hover {
    background: var(--overlay-1, rgba(255, 255, 255, 0.05));
  }

  .group-icon {
    flex: none;
    width: 17px;
    height: 17px;
    background: var(--group-ink);
  }

  .group-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .group-label {
    font: var(--weight-semibold) var(--text-md) / 1.25 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .group-bar {
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--overlay-2, rgba(255, 255, 255, 0.09));
    overflow: hidden;
  }

  .group-fill {
    height: 100%;
    background: var(--group-ink);
    transition: width var(--duration-slow, 280ms) var(--ease-out);
  }

  .group-count {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .group-chevron {
    flex: none;
    width: 13px;
    height: 13px;
    background: var(--ink-4, #7c7c8c);
    mask: var(--icon-chevron-right) center/contain no-repeat;
    transition: transform var(--duration-base, 200ms) var(--ease-out);
  }

  .open .group-chevron {
    transform: rotate(90deg);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 var(--space-12) var(--space-12);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-10);
    min-height: 36px;
    padding: 0 var(--space-8);
    box-sizing: border-box;
    border-radius: var(--radius-sm);
    background: transparent;
  }

  .row.hl {
    background: color-mix(in oklch, var(--accent, #ff5672) 14%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent, #ff5672) 40%, transparent);
  }

  .mark {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--line-3, rgba(255, 255, 255, 0.24));
  }

  .done .mark {
    background: color-mix(in srgb, var(--status-online, #2ee6a8) 16%, transparent);
    box-shadow: none;
  }

  .mark-check {
    width: 10px;
    height: 10px;
    background: var(--status-online, #2ee6a8);
    mask: var(--icon-check) center/contain no-repeat;
    opacity: 0;
  }

  .done .mark-check {
    opacity: 1;
  }

  .row-label {
    flex: 1;
    min-width: 0;
    font: var(--weight-regular) var(--text-md) / 1.3 var(--font-sans);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .done .row-label {
    color: var(--ink-3, #9a9aa8);
  }

  .row-reward {
    flex: none;
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-mono);
    color: var(--status-chit, #ff9f45);
  }

  .done .row-reward {
    color: var(--ink-4, #7c7c8c);
  }

  .hl .row-reward {
    color: var(--accent-bright, #ff8298);
  }

  .empty {
    padding: var(--space-8);
    font: var(--weight-regular) var(--text-md) / 1.5 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }
</style>
