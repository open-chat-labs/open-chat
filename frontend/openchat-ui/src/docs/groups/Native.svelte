<!-- Native: the shell kit in src/native, one <Section> per entry in sections.ts `native`. Every demo is a phone-sized
     native root (NativeFrame) on the docs' mode and accent, and the platform picked here. -->
<script lang="ts">
  import Section from '../Section.svelte';
  import NativeFrame from '../NativeFrame.svelte';
  import { native, sec } from '../sections';
  import { nativeChats, nativeCommunities, nativePeople, nativeTabs, nativeTabsNoPhoto } from '../samples';
  import { Avatar, Button, ChatRow, Field, SegmentedTabs, Toggle } from '../../lib/index';
  import { AnchoredMenu, BottomSheet, LongPressMenu, NativePageHeader, TabBar, longPress, type NativeMenuItem } from '../../native/index';
  import { useT } from '../../lib/i18n';

  interface Props {
    mode: string;
    accent: string;
  }

  let { mode, accent }: Props = $props();
  const t = useT();

  const OSES = ['ios', 'android'] as const;
  let os = $state<(typeof OSES)[number]>('ios');

  // tab bar
  let tab = $state('chats');
  let tabNoPhoto = $state('you');

  // page header
  let headerLog = $state('');
  const log = (what: string) => () => (headerLog = what);

  // bottom sheet: short settings that fit their content, and a picker whose steps keep one height
  let settingsOpen = $state(false);
  const pollSettings = $state({ publicVotes: true, multiple: false, lock: false });
  let pickerOpen = $state(false);
  let pickerQuery = $state('');
  let picked = $state<(typeof nativePeople)[number] | null>(null);
  let chosen = $state('');
  const pickerRows = $derived(nativePeople.filter((p) => !pickerQuery || p.name.toLowerCase().includes(pickerQuery.toLowerCase())));
  const openPicker = () => ((pickerQuery = ''), (picked = null), (pickerOpen = true));

  // anchored menu: a header's kebab, and value rows (the lower one opens above)
  let menuLog = $state('');
  let kebabAnchor = $state<HTMLElement | null>(null);
  const MUTE_FOR = ['1 hour', '8 hours', '1 week', 'docs.native.menu.forever'];
  let muted = $state('');
  const muteItems = (): NativeMenuItem[] => MUTE_FOR.map((d) => ({ id: 'mute:' + d, label: d, selected: muted === d }));
  const kebabItems = $derived<NativeMenuItem[]>([
    { id: 'search', label: 'docs.native.menu.search', icon: 'search' },
    { id: 'details', label: 'docs.native.menu.details', icon: 'info' },
    muted
      ? { id: 'unmute', label: 'docs.native.menu.unmute', icon: 'bell' }
      : { id: 'mute', label: 'docs.native.menu.mute', icon: 'bell-off', submenu: { title: 'docs.native.menu.muteFor', items: muteItems() } },
    { id: 'favourite', label: 'docs.native.menu.favourite', icon: 'star' },
    { id: 'disappearing', label: 'docs.native.menu.disappearing', icon: 'timer' },
    { id: 'clear', label: 'docs.native.menu.clear', icon: 'trash', separator: true, danger: true },
    { id: 'block', label: 'docs.native.menu.block', icon: 'ban', danger: true },
  ]);
  function onKebab(id: string) {
    menuLog = id;
    if (id.startsWith('mute:')) muted = id.slice(5);
    if (id === 'unmute') muted = '';
  }
  const SOUNDS = ['Chime', 'Pop', 'Bell', 'None'];
  const DOWNLOADS = ['docs.native.menu.never', 'docs.native.menu.wifi', 'docs.native.menu.always'];
  let sound = $state(0);
  let download = $state(1);
  let valueMenu = $state<{ anchor: HTMLElement; which: 'sound' | 'download' } | null>(null);
  const valueItems = $derived<NativeMenuItem[]>(
    valueMenu?.which === 'sound'
      ? SOUNDS.map((s, i) => ({ id: String(i), label: s, selected: i === sound }))
      : DOWNLOADS.map((s, i) => ({ id: String(i), label: s, selected: i === download })),
  );

  // long-press: chat rows lift as themselves; a strip avatar lifts as a wider card
  type DemoChat = (typeof nativeChats)[number];
  let rowMenu = $state<{ open: boolean; el: HTMLElement | null; chat: DemoChat }>({ open: false, el: null, chat: nativeChats[0] });
  const rowItems = $derived<NativeMenuItem[]>([
    { id: 'pin', label: rowMenu.chat.pinned ? 'docs.native.menu.unpin' : 'docs.native.menu.pin', icon: 'pin' },
    { id: 'favourite', label: 'docs.native.menu.favourite', icon: 'star' },
    { id: 'mute', label: 'docs.native.menu.mute', icon: 'bell-off', submenu: { title: 'docs.native.menu.muteFor', items: MUTE_FOR.map((d) => ({ id: 'mute:' + d, label: d })) } },
    { id: 'read', label: 'docs.native.menu.markRead', icon: 'check' },
    { id: 'archive', label: 'docs.native.menu.archive', icon: 'layers' },
    rowMenu.chat.kind === 'group'
      ? { id: 'leave', label: 'docs.native.menu.leaveGroup', icon: 'exit', separator: true, danger: true }
      : { id: 'delete', label: 'docs.native.menu.deleteChat', icon: 'trash', separator: true, danger: true },
  ]);
  type DemoCommunity = (typeof nativeCommunities)[number];
  let stripMenu = $state<{ open: boolean; el: HTMLElement | null; community: DemoCommunity }>({ open: false, el: null, community: nativeCommunities[0] });
  const stripItems: NativeMenuItem[] = [
    { id: 'top', label: 'docs.native.menu.moveToTop', icon: 'pin' },
    { id: 'mute', label: 'docs.native.menu.muteCommunity', icon: 'bell-off' },
    { id: 'read', label: 'docs.native.menu.markAllRead', icon: 'check' },
    { id: 'leave', label: 'docs.native.menu.leaveCommunity', icon: 'exit', separator: true, danger: true },
  ];
  let pressLog = $state('');
</script>

<div class="native">
  <div class="platform">
    <span class="platform-label">data-os</span>
    <div class="platform-tabs">
      <SegmentedTabs size="sm" labels={['docs.native.ios', 'docs.native.android']} selectedIndex={OSES.indexOf(os)} dotOnLast={false} onSelect={(i) => (os = OSES[i])} />
    </div>
  </div>

  <Section {...sec(native, 'native-tab-bar')}>
    <div class="grid2">
      <NativeFrame {os} {mode} {accent} label="Unread count · dot · your photo" height={180}>
        <div class="screen"><span class="screen-note">{tab}</span></div>
        <TabBar tabs={nativeTabs} selected={tab} onSelect={(id) => (tab = id)} />
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="No photo yet · You selected" height={180}>
        <div class="screen"><span class="screen-note">{tabNoPhoto}</span></div>
        <TabBar tabs={nativeTabsNoPhoto} selected={tabNoPhoto} onSelect={(id) => (tabNoPhoto = id)} />
      </NativeFrame>
    </div>
  </Section>

  <Section {...sec(native, 'native-page-header')}>
    <div class="grid2">
      <NativeFrame {os} {mode} {accent} label="Tab root · size=lg · a custom button · kebab" height={120}>
        <NativePageHeader title="docs.native.header.chats" size="lg" onMore={log('more')}>
          <button type="button" class="chit" aria-label="CHIT" onclick={log('chit')}><span class="chit-icon"></span></button>
        </NativePageHeader>
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="Pushed page · back · kebab" height={120}>
        <NativePageHeader title="docs.native.header.members" onBack={log('back')} onMore={log('more')} />
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="Conversation · avatar · actions · divider" height={120}>
        <NativePageHeader
          title="Lucy Linden"
          sub="docs.native.header.online"
          divider
          onBack={log('back')}
          onTitleClick={log('details')}
          titleLabel="docs.native.header.details"
          actions={[
            { icon: 'video', label: 'docs.native.header.video', onClick: log('video') },
            { icon: 'phone', label: 'docs.native.header.voice', onClick: log('voice') },
          ]}
          onMore={log('more')}
        >
          {#snippet avatar()}<Avatar size={36} color="plum" online />{/snippet}
        </NativePageHeader>
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="A long title · no actions" height={120}>
        <NativePageHeader title="docs.native.header.long" onBack={log('back')} />
      </NativeFrame>
    </div>
    <p class="note">Last tap: <code>{headerLog || '—'}</code></p>
  </Section>

  <Section {...sec(native, 'native-bottom-sheet')}>
    <div class="grid2">
      <NativeFrame {os} {mode} {accent} label="Fits its content · title · Done" height={560}>
        <div class="screen"><Button label="docs.native.sheet.openSettings" variant="secondary" onClick={() => (settingsOpen = true)} /></div>
        <BottomSheet open={settingsOpen} onClose={() => (settingsOpen = false)} title="docs.native.sheet.settings" onAction={() => (settingsOpen = false)}>
          <div class="sheet-settings">
            <Toggle label="docs.native.sheet.publicVotes" help="docs.native.sheet.publicVotesHelp" on={pollSettings.publicVotes} onChange={(on) => (pollSettings.publicVotes = on)} />
            <Toggle label="docs.native.sheet.multiple" help="docs.native.sheet.multipleHelp" on={pollSettings.multiple} onChange={(on) => (pollSettings.multiple = on)} />
            <Toggle label="docs.native.sheet.lock" help="docs.native.sheet.lockHelp" on={pollSettings.lock} onChange={(on) => (pollSettings.lock = on)} />
          </div>
        </BottomSheet>
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="Search → confirm · one fixed height" height={560}>
        <div class="screen column">
          <Button label="docs.native.sheet.openPicker" variant="secondary" onClick={openPicker} />
          {#if chosen}<span class="screen-note">{chosen}</span>{/if}
        </div>
        <BottomSheet open={pickerOpen} onClose={() => (pickerOpen = false)} label="docs.native.sheet.who" height="72%">
          {#snippet header()}
            {#if !picked}<span class="sheet-heading">{t('docs.native.sheet.who')}</span>{/if}
          {/snippet}
          {#if picked}
            <div class="sheet-confirm">
              <Avatar size={112} color={picked.color} />
              <span class="sheet-name">{picked.name}</span>
              <span class="sheet-handle">{picked.handle}</span>
              <div class="sheet-buttons">
                <Button label="docs.native.sheet.thatsThem" size="lg" fullWidth onClick={() => ((chosen = picked?.name ?? ''), (pickerOpen = false))} />
                <Button label="docs.native.sheet.someoneElse" variant="ghost" size="lg" fullWidth onClick={() => (picked = null)} />
              </div>
            </div>
          {:else}
            <div class="sheet-search"><Field placeholder="docs.native.sheet.search" value={pickerQuery} onInput={(e) => (pickerQuery = e.currentTarget.value)} onClear={() => (pickerQuery = '')} /></div>
            <div class="sheet-rows">
              {#each pickerRows as p (p.handle)}
                <button type="button" class="sheet-row" onclick={() => (picked = p)}>
                  <Avatar size={40} color={p.color} />
                  <span class="sheet-row-text"><span class="sheet-name small">{p.name}</span><span class="sheet-handle">{p.handle}</span></span>
                </button>
              {/each}
            </div>
          {/if}
        </BottomSheet>
      </NativeFrame>
    </div>
    <p class="note">Drag either by its handle or header: past 30% of its height, or a flick down, closes it; otherwise it springs back, and pulled up it gives 24px. The picker keeps its 72% height through both steps.</p>
  </Section>

  <Section {...sec(native, 'native-anchored-menu')}>
    <div class="grid2">
      <NativeFrame {os} {mode} {accent} label="A header's kebab · submenu · destructive" height={520}>
        <NativePageHeader title="Lucy Linden" sub="docs.native.header.online" onBack={() => {}} onMore={(a) => (kebabAnchor = a)}>
          {#snippet avatar()}<Avatar size={36} color="plum" online />{/snippet}
        </NativePageHeader>
        <AnchoredMenu anchor={kebabAnchor} items={kebabItems} label="docs.native.menu.options" onSelect={onKebab} onClose={() => (kebabAnchor = null)} />
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="Value rows · ticked · opens above near the bottom" height={520}>
        <div class="value-screen">
          <div class="value-card">
            <button type="button" class="value-row" onclick={(e) => (valueMenu = { anchor: e.currentTarget, which: 'sound' })}><span>{t('docs.native.menu.sound')}</span><b>{SOUNDS[sound]}</b><i></i></button>
          </div>
          <div class="value-card">
            <button type="button" class="value-row" onclick={(e) => (valueMenu = { anchor: e.currentTarget, which: 'download' })}><span>{t('docs.native.menu.autoDownload')}</span><b>{t(DOWNLOADS[download])}</b><i></i></button>
          </div>
        </div>
        <AnchoredMenu
          anchor={valueMenu?.anchor ?? null}
          items={valueItems}
          label={valueMenu?.which === 'sound' ? 'docs.native.menu.sound' : 'docs.native.menu.autoDownload'}
          onSelect={(id) => (valueMenu?.which === 'sound' ? (sound = Number(id)) : (download = Number(id)))}
          onClose={() => (valueMenu = null)}
        />
      </NativeFrame>
    </div>
    <p class="note">Last pick: <code>{menuLog || '—'}</code></p>
  </Section>

  <Section {...sec(native, 'native-long-press-menu')}>
    <div class="grid2">
      <NativeFrame {os} {mode} {accent} label="Hold a row (or right-click it)" height={560}>
        <div class="press-rows">
          {#each nativeChats as chat (chat.id)}
            <div use:longPress={(el) => (rowMenu = { open: true, el, chat })}>
              <ChatRow title={chat.title} preview={chat.preview} time={chat.time} kind={chat.kind} color={chat.color} unreadCount={chat.unreadCount} pinned={chat.pinned} online={chat.online} onClick={() => (pressLog = 'open ' + chat.title)} />
            </div>
          {/each}
        </div>
        <LongPressMenu
          open={rowMenu.open}
          target={rowMenu.el}
          items={rowItems}
          label={t('docs.native.menu.rowOptions', { name: rowMenu.chat.title })}
          onSelect={(id) => (pressLog = id + ' · ' + rowMenu.chat.title)}
          onClose={() => (rowMenu.open = false)}
        >
          {#snippet row()}
            <ChatRow title={rowMenu.chat.title} preview={rowMenu.chat.preview} time={rowMenu.chat.time} kind={rowMenu.chat.kind} color={rowMenu.chat.color} unreadCount={rowMenu.chat.unreadCount} pinned={rowMenu.chat.pinned} online={rowMenu.chat.online} />
          {/snippet}
        </LongPressMenu>
      </NativeFrame>
      <NativeFrame {os} {mode} {accent} label="A small target lifts as a 240px card" height={560}>
        <div class="strip">
          {#each nativeCommunities as c (c.name)}
            <button type="button" class="strip-avatar" style:background={c.grad} aria-label={c.name} use:longPress={(el) => (stripMenu = { open: true, el, community: c })} onclick={() => (pressLog = 'open ' + c.name)}></button>
          {/each}
        </div>
        <LongPressMenu
          open={stripMenu.open}
          target={stripMenu.el}
          items={stripItems}
          label={t('docs.native.menu.rowOptions', { name: stripMenu.community.name })}
          onSelect={(id) => (pressLog = id + ' · ' + stripMenu.community.name)}
          onClose={() => (stripMenu.open = false)}
        >
          {#snippet row()}
            <div class="strip-card">
              <span class="strip-card-avatar" style:background={stripMenu.community.grad}></span>
              <span class="strip-card-text"><b>{stripMenu.community.name}</b><span>{stripMenu.community.members}</span></span>
            </div>
          {/snippet}
        </LongPressMenu>
      </NativeFrame>
    </div>
    <p class="note">Last: <code>{pressLog || '—'}</code>. A tap still opens the row; the click that ends a long-press doesn't.</p>
  </Section>
</div>

<style lang="scss">
  @use '../../lib/styles/mixins' as *;

  .native { display: flex; flex-direction: column; gap: 56px; }
  .platform { position: sticky; top: 92px; z-index: 5; align-self: flex-start; display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 14px; background: var(--surface-1); box-shadow: inset 0 0 0 1px var(--line-1); }
  .platform-label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .platform-tabs { width: 220px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 24px; }
  .screen { flex: 1; min-height: 0; @include flex-center; }
  .screen-note { font: 500 12px/1 var(--font-mono); color: var(--ink-4); }
  .note { margin: 0; font: 400 13px/1.5 var(--font-sans); color: var(--ink-3); }
  .chit { width: var(--touch-target); height: var(--touch-target); @include flex-center; padding: 0; border: 0; background: none; cursor: pointer; }
  .chit-icon { @include icon(zap, 20px, var(--status-chit)); }
  .screen.column { flex-direction: column; gap: 12px; }
  .sheet-settings { display: flex; flex-direction: column; gap: 32px; padding: 8px 20px 40px; }
  .sheet-heading { display: block; padding: 6px 20px 12px; font: 800 20px/1.2 var(--font-sans); }
  .sheet-search { flex: none; padding: 0 16px 10px; }
  .sheet-rows { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding: 0 16px 24px; }
  .sheet-row { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 10px; border: 0; border-radius: 14px; background: none; color: inherit; text-align: start; cursor: pointer; }
  .sheet-row:active { background: var(--overlay-1); }
  .sheet-row-text { display: flex; flex-direction: column; gap: 4px; }
  .sheet-confirm { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 20px; }
  .sheet-name { margin-top: 10px; font: 800 22px/1.2 var(--font-sans); }
  .sheet-name.small { margin: 0; font: 600 15px/1.2 var(--font-sans); }
  .sheet-handle { font: 500 13px/1 var(--font-sans); color: var(--ink-4); }
  .sheet-buttons { width: 100%; margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
  .value-screen { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 24px 16px; }
  .value-card { border-radius: 16px; background: var(--overlay-1); overflow: hidden; }
  .value-row { width: 100%; display: flex; align-items: center; gap: 14px; min-height: 60px; padding: 10px 16px; border: 0; background: none; color: var(--ink); cursor: pointer; text-align: start; }
  .value-row span { flex: 1; font: 500 15px/1.2 var(--font-sans); }
  .value-row b { font: 500 13px/1.2 var(--font-sans); color: var(--ink-2); }
  .value-row i { @include icon(chevron-down, 14px, var(--ink-4)); }
  .press-rows { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; padding: 8px 6px; }
  .strip { display: flex; gap: 12px; padding: 16px 18px; }
  .strip-avatar { width: 42px; height: 42px; border: 0; border-radius: 12px; cursor: pointer; }
  .strip-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .strip-card-avatar { flex: none; width: 42px; height: 42px; border-radius: 12px; }
  .strip-card-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .strip-card-text b { font: 700 15px/1.2 var(--font-sans); @include truncate; }
  .strip-card-text span { font: 500 12.5px/1 var(--font-sans); color: var(--ink-4); }
</style>
