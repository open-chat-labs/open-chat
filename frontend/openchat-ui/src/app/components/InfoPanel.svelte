<!-- Side-panel details for a user or group: cover with actions, avatar (online dot for users), name, handle or byline,
     quick tiles, detail cards, chat-setting toggles and a footer (secondary + danger action).
     A toggle titled "Disappearing messages" grows a duration picker while on; its state is kept here. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Badge from '../../lib/components/Badge.svelte';
  import Button from '../../lib/components/Button.svelte';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import DurationChips from '../../lib/components/DurationChips.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';
  import TileButtons from '../../lib/components/TileButtons.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';

  const GRADIENTS = {
    violet: 'linear-gradient(140deg,#ff5f9e,#6a2bff)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };

  type CoverProps = ComponentProps<typeof PanelCover>;
  type TileProps = ComponentProps<typeof TileButtons>;

  interface Detail {
    label: string;
    value: string;
    variant?: 'value' | 'prose';
    dot?: boolean;
    highlight?: boolean;
    /** Spans both columns. */
    wide?: boolean;
  }

  interface SettingToggle {
    title: string;
    hint: string;
    on: boolean;
    onChange?: (on: boolean) => void;
  }

  interface Props {
    kind?: 'user' | 'group';
    title: string;
    handle?: string;
    /** Groups: "created by <bylineName>". */
    bylineName?: string;
    bylinePrefix?: string;
    verified?: boolean;
    online?: boolean;
    color?: keyof typeof GRADIENTS;
    cover?: string;
    coverActions?: CoverProps['actions'];
    /** Defaults to favourite (users) or favourite, share, more (groups). */
    coverTrailActions?: CoverProps['trailActions'];
    coverHandlers?: CoverProps['handlers'];
    tiles?: TileProps['tiles'];
    tileHandlers?: TileProps['handlers'];
    details?: Detail[];
    toggles?: SettingToggle[];
    disappearOn?: boolean;
    disappearAfter?: string;
    showFooter?: boolean;
    /** Secondary footer action (e.g. Report); empty hides it. */
    footerLabel?: string;
    dangerLabel?: string;
    onFooter?: () => void;
    onDanger?: () => void;
  }

  let {
    kind = 'user',
    title,
    handle = '',
    bylineName = '',
    bylinePrefix = 'created by',
    verified = false,
    online = false,
    color = 'violet',
    cover = '',
    coverActions = ['close'],
    coverTrailActions,
    coverHandlers = {},
    tiles = ['video', 'mute', 'search'],
    tileHandlers = {},
    details = [],
    toggles = [],
    disappearOn = true,
    disappearAfter = '12 hours',
    showFooter = true,
    footerLabel = '',
    dangerLabel = 'Block user',
    onFooter,
    onDanger,
  }: Props = $props();

  let dmOn = $derived(disappearOn);
  let dmAfter = $derived(disappearAfter);

  const user = $derived(kind === 'user');
  const rows = $derived(
    toggles.map((row) =>
      /disappearing/i.test(row.title)
        ? {
            ...row,
            disappearing: true,
            on: dmOn,
            hint: dmOn ? `Messages older than ${dmAfter} are deleted automatically.` : 'Messages are kept until someone deletes them.',
            onChange: (next: boolean) => (dmOn = next),
          }
        : { ...row, disappearing: false },
    ),
  );
</script>

<div class="panel">
  <div class="cell">
    <PanelCover {cover} actions={coverActions} trailActions={coverTrailActions ?? (user ? ['favourite'] : ['favourite', 'share', 'more'])} handlers={coverHandlers} />
  </div>

  <div class="identity">
    <div class="avatar" class:squircle={!user} style:background={GRADIENTS[color] ?? GRADIENTS.violet}>
      {#if online && user}
        <span class="online"></span>
      {/if}
    </div>
    <div class="names">
      <div class="title-line">
        <span class="title">{title}</span>
        {#if verified && user}
          <span class="badge"><Badge variant="verified" /></span>
        {/if}
      </div>
      {#if handle}
        <span class="handle">{handle}</span>
      {/if}
      {#if bylineName}
        <span class="byline">{bylinePrefix} <a href="#top">{bylineName}</a></span>
      {/if}
    </div>
    <div class="tiles">
      <div class="cell"><TileButtons {tiles} handlers={tileHandlers} /></div>
    </div>
  </div>

  <div class="scroll">
    <div class="details">
      {#each details as item}
        <div class="detail" class:wide={item.wide}>
          <DetailSection label={item.label} value={item.value} variant={item.variant ?? 'value'} dot={item.dot ?? false} highlight={item.highlight ?? false} />
        </div>
      {/each}
    </div>
    {#if rows.length > 0}
      <div class="settings">
        <span class="settings-title">CHAT SETTINGS</span>
        <div class="settings-list">
          {#each rows as row}
            <div class="setting">
              <div class="setting-text">
                <span class="setting-title">{row.title}</span>
                <span class="setting-hint">{row.hint}</span>
              </div>
              <div class="setting-toggle"><Toggle on={row.on} onChange={row.onChange} /></div>
            </div>
            {#if row.disappearing && dmOn}
              <DurationChips value={dmAfter} title="Disappearing messages timeout" hint="How long a message survives before it is deleted for everyone." onChange={(d) => (dmAfter = d)} />
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if showFooter}
    <div class="footer">
      {#if footerLabel}
        <div class="footer-cell"><Button fullWidth={true} variant="secondary" label={footerLabel} onClick={onFooter} /></div>
      {/if}
      <div class="footer-cell"><Button fullWidth={true} variant="danger" label={dangerLabel} onClick={onDanger} /></div>
    </div>
  {/if}
</div>

<style>
  .panel {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1, #0e0e12);
    border-radius: var(--radius-2xl);
  }

  .cell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .identity {
    padding: 0 var(--space-14) var(--space-26);
    margin-top: -34px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-10);
  }

  .avatar {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: var(--radius-pill);
    box-shadow: 0 0 0 4px var(--surface-1, #0e0e12);
  }

  .avatar.squircle {
    border-radius: 24px;
  }

  .online {
    position: absolute;
    bottom: 2px;
    inset-inline-end: 2px;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-pill);
    background: var(--status-online, #2ee6a8);
    border: 3px solid var(--surface-1, #0e0e12);
  }

  .names {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-8);
    max-width: 100%;
  }

  .title-line {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    max-width: 100%;
  }

  .title {
    font: var(--weight-bold) var(--text-xl) / 1.2 var(--font-sans);
    letter-spacing: var(--tracking-tight);
    color: var(--ink, #ececf1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    flex: none;
    display: grid;
    grid-template-columns: max-content;
  }

  .handle {
    font: var(--weight-medium) var(--text-md) / 1 var(--font-mono);
    color: var(--ink-3, #9a9aa8);
  }

  .byline {
    font: var(--weight-regular) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3, #9a9aa8);
  }

  .byline a {
    color: var(--accent, #ff5672);
  }

  .tiles {
    width: 100%;
    margin-top: var(--space-26);
  }

  .scroll {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 var(--space-16) var(--space-16);
    display: flex;
    flex-direction: column;
    gap: var(--space-26);
  }

  .details {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-6);
  }

  .detail {
    grid-column: auto;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .detail.wide {
    grid-column: span 2;
  }

  .settings {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    margin-top: -8px;
  }

  .settings-title {
    padding-inline-start: var(--space-16);
    font: var(--weight-semibold) var(--text-xs) / 1 var(--font-mono);
    letter-spacing: var(--tracking-wide);
    color: var(--ink-3, #9a9aa8);
  }

  .settings-list {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .setting {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-14);
    padding: var(--space-10) var(--space-16);
  }

  .setting-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .setting-title {
    font: var(--weight-semibold) var(--text-base) / 1 var(--font-sans);
    color: var(--ink, #e4e4ec);
  }

  .setting-hint {
    font: var(--weight-regular) var(--text-sm) / 1.45 var(--font-sans);
    color: var(--ink-4, #7c7c8c);
    text-wrap: pretty;
  }

  .setting-toggle {
    flex: none;
    display: flex;
  }

  .footer {
    flex: none;
    padding: var(--space-12) var(--space-16) var(--space-16);
    display: flex;
    gap: var(--space-6);
  }

  .footer-cell {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
</style>
