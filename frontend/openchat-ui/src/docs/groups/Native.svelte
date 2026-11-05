<!-- Native: the shell kit in src/native, one <Section> per entry in sections.ts `native`. Every demo is a phone-sized
     native root (NativeFrame) on the docs' mode and accent, and the platform picked here. -->
<script lang="ts">
  import Section from '../Section.svelte';
  import NativeFrame from '../NativeFrame.svelte';
  import { native, sec } from '../sections';
  import { nativeTabs, nativeTabsNoPhoto } from '../samples';
  import { Avatar, SegmentedTabs } from '../../lib/index';
  import { NativePageHeader, TabBar } from '../../native/index';

  interface Props {
    mode: string;
    accent: string;
  }

  let { mode, accent }: Props = $props();

  const OSES = ['ios', 'android'] as const;
  let os = $state<(typeof OSES)[number]>('ios');

  // tab bar
  let tab = $state('chats');
  let tabNoPhoto = $state('you');

  // page header
  let headerLog = $state('');
  const log = (what: string) => () => (headerLog = what);
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
</style>
