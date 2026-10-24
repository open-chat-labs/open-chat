<!-- Features: OpenChat-specific components and patterns, one <Section> per entry in sections.ts `features`. Demo data in samples.ts. -->
<script lang="ts">
  import { onMount, tick, type Component, type ComponentProps } from 'svelte';
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import { features, sec } from '../sections';
  import {
    samples, callPeople, coinSizes as coins, dividerThread, headerMenu, infoDetails, joinGate, messageActionItems,
    patternRows, receivedGroup, sentGroup, threadFaces, threadGroups, threadReplies, threadRoot, tiles,
  } from '../samples';
  import * as S from '../samples';
  import {
    ActivityRow, CallEvent, ChatBubble, ChatRow, ComposerBar, EmojiPicker, EmptyState, FileMessage, LinkPreview,
    MediaMessage, MemberRow, MessageComposer, PanelCover, PanelNavRow, PollMessage, PrizeMessage, ProposalMessage,
    StatCard, StatsDonut, SwapOffer as SwapOfferMessage, TileButtons, TransferMessage, TypingIndicator, VoiceMessage,
    Button, MessageActions, MessageGroup, SegmentedTabs, TokenCoin, UnreadDivider,
  } from '../../lib/index';
  import {
    AchievementToast, BalanceCard, NavRail, CallPanel, ChatListHeader, ChatListPanel, ConversationHeader, DailyPuzzleCard,
    DmPanel, GroupPanel, GroupStats, InfoPanel, JoinGateDialog, MiniCall, PollBuilderDialog, PuzzleDialog, ThreadList,
    ThreadPanel, VideoTile,
  } from '../../features/index';
  import * as F from '../../features/index';
  import { Landing, Learn, type LearnPage, type PageAccent, type PageMode } from '../../pages/index';
  import { demoProps, keepLinksInFrame, previewSize } from '../demo';
  import type { GroupMessage } from '../../lib/types';

  interface Props {
    /** The docs' theme, passed to the pages (each page is its own theme root). */
    mode: PageMode;
    accent: PageAccent;
  }

  let { mode, accent }: Props = $props();

  // Learn shows how a host routes it: the sub-page lives here, as it would in the app's router
  let learnPage = $state<LearnPage>('roadmap');
  let learnPost = $state<string | undefined>();

  let selectedRow = $state(2);
  let picked = $state<string[]>(['🔥']);
  let voicePlaying = $state(false);
  let veiled = $state(false);
  let navActive = $state(0);
  let tileTaps = $state(0);

  const donut = samples.StatsDonut as { slices: { label: string; count: number }[]; extras: { label: string; count: string }[] };

  // ── AppB ──
  const groupPanel = samples.GroupPanel as unknown as ComponentProps<typeof GroupPanel>;
  const groupStats = samples.GroupStats as unknown as ComponentProps<typeof GroupStats>;

  // Pattern · Message group: reactions toggle locally
  const received = $state<GroupMessage[]>(structuredClone(receivedGroup));
  function toggle(list: GroupMessage[], index: number, emoji: string) {
    const m = list[index];
    const rs = (m.reactions ??= []);
    const r = rs.find((x) => x.emoji === emoji);
    if (!r) rs.push({ emoji, count: 1, mine: true });
    else if (r.mine) {
      r.count--;
      r.mine = false;
      if (!r.count) rs.splice(rs.indexOf(r), 1);
    } else {
      r.count++;
      r.mine = true;
    }
  }

  // Pattern · Dividers: opens pinned to the newest message and re-pins on any height change
  // until the reader takes over (scroll, wheel, touch or key).
  let thread: HTMLDivElement;
  let pinned = true;
  const pin = () => {
    if (pinned && thread) thread.scrollTop = thread.scrollHeight;
  };
  const release = () => (pinned = false);
  onMount(() => {
    // bind:this nulls the refs before teardown runs (e.g. on hot reload), so hold the elements locally
    const el = thread, btn = trigger;
    pin();
    const ro = new ResizeObserver(pin);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    // programmatic pinning fires scroll events too; only a scroll away from the bottom counts as the reader's
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight > 2) release();
    };
    const gestures = ['wheel', 'touchstart', 'keydown'] as const;
    el.addEventListener('scroll', onScroll, { passive: true });
    for (const g of gestures) el.addEventListener(g, release, { passive: true });
    const remember = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY });
    btn.addEventListener('pointerdown', remember);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      for (const g of gestures) el.removeEventListener(g, release);
      btn.removeEventListener('pointerdown', remember);
    };
  });

  // Puzzle card state
  let remind = $state(false);

  // Threads
  let following = $state(true);

  // Dialogs
  let dialog = $state<'' | 'join' | 'poll' | 'puzzle'>('');
  // MessageActions opens at the click point; keyboard activation (no pointer) falls back to the button's centre
  let actionsAt = $state<{ x: number; y: number } | null>(null);
  let pointer: { x: number; y: number } | null = null;
  let trigger: HTMLSpanElement;
  async function openActions() {
    const r = trigger.getBoundingClientRect();
    const at = pointer ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    pointer = null;
    actionsAt = null;
    await tick();
    actionsAt = at;
  }

  // ── Whole feature screens and dialogs, rendered with their demo props (demo.ts) ──
  // demo props come from data, so every component is treated as taking loose props
  const featureComponents = F as unknown as Record<string, Component<Record<string, unknown>>>;
  const walletScreens = ['WalletMain', 'WalletSend', 'WalletReceive', 'WalletSwap', 'WalletRecipients'];
  const walletTabs = ['docs.features.wallet.main', 'ui.common.send', 'docs.features.wallet.receive', 'docs.features.wallet.swap', 'docs.features.wallet.recipients'];
  let walletScreen = $state(0);
  let openDialog = $state<string | null>(null);

  // AchievementToast plays once on mount: each press remounts it (new key) with the next achievement
  const achievements = [
    { title: 'docs.features.achievements.sayCheese', icon: 'camera', reward: 500 },
    { title: 'docs.features.achievements.firstSwap', icon: 'swap', reward: 1200 },
    { title: 'docs.features.achievements.streak7', icon: 'flame', reward: 250 },
  ];
  let toastRuns = 0;
  let toast = $state(0);
  // opener labels are docs keys: docs.features.open.<dialog name without 'Dialog', camelCase>
  const dialogLabel = (n: string) => 'docs.features.open.' + n.replace(/Dialog$/, '').replace(/^./, (c) => c.toLowerCase());
</script>

<!-- App group, part A: chat summaries … wallet blocks. -->

<Section {...sec(features, 'chat-summaries')}>
  <div class="grid2">
    <Frame label="ChatRow · states">
      <div class="stack">
        <span class="cap">DEFAULT</span>
        <ChatRow title="Lucy Linden" preview="Sounds good, see you at 6" time="10:42" color="teal" online menuItems={S.chatRowMenu} />
        <span class="cap">HOVER</span>
        <div class="force-hover">
          <ChatRow title="Design Guild" kind="group" preview="Ana: the new tokens are in" time="10:31" color="violet" menuItems={S.chatRowMenu} />
        </div>
        <span class="cap">SELECTED</span>
        <ChatRow title="Matt Rivers" preview="Pushed the fix to v3" time="09:58" color="amber" verified selected={selectedRow === 2} onClick={() => (selectedRow = 2)} menuItems={S.chatRowMenu} />
        <span class="cap">TYPING</span>
        <ChatRow title="Priya Raman" preview="" time="09:40" color="plum" typing online />
        <span class="cap">UNREAD · PINNED · MUTED</span>
        <ChatRow title="general" kind="channel" preview="Hamish: Release train leaves at 3pm" time="09:12" color="blue" unreadCount={12} pinned />
        <ChatRow title="OpenChat Devs" kind="group" preview="Julian: 🎉 merged" time="Mon" color="teal" unreadCount={3} muted liveCall="voice" />
      </div>
    </Frame>
    <Frame label="ActivityRow · notifications">
      <div class="stack">
        <ActivityRow title="Bob and two others reacted to your message" context="OpenChat Labs / Engineering" preview="You / The illustration slot is in" time="44 min" unread reactions={['👍', '🔥', '😂']} color="violet" />
        <ActivityRow title="Lucy mentioned you" context="Design Guild / #tokens" preview="@you can you check the light ramp?" time="2 h" color="teal" kind="group" unread />
        <ActivityRow title="Matt replied to your message" context="Matt Rivers" preview="Matt / Yep, shipping it today" time="Yesterday" color="amber" />
      </div>
    </Frame>
  </div>
</Section>

<Section {...sec(features, 'messages')}>
  <div class="grid2">
    <Frame label="Received">
      <div class="thread">
        <ChatBubble side="received" text="Morning! Did the new tokens land?" time="09:02" lastInGroup={false} />
        <ChatBubble side="received" text="They look great in light mode 👌" time="09:02" reactions={S.reactions} />
        <ChatBubble side="received" text="Original from the design channel" time="09:05" forwarded />
        <ChatBubble side="received" text="Moved the review to Thursday." time="09:07" edited />
        <ChatBubble side="received" text="" time="09:08" deleted />
        <ChatBubble side="received" text="Agreed, ship it." time="09:10" quoteName="Matt" quoteText="Can we ship the ramp today?" />
        <VoiceMessage side="received" elapsed="0:07" total="0:24" progress={0.3} time="09:12" playing={voicePlaying} onPlay={() => (voicePlaying = true)} onPause={() => (voicePlaying = false)} />
        <TypingIndicator names={['Danielle', 'Priya']} colors={['violet', 'teal']} />
      </div>
    </Frame>
    <Frame label="Sent">
      <div class="thread sent">
        <ChatBubble side="sent" text="Sending…" time="09:20" status="sending" lastInGroup={false} />
        <ChatBubble side="sent" text="Sent, not yet delivered" time="09:20" status="sent" lastInGroup={false} />
        <ChatBubble side="sent" text="Delivered ✓✓" time="09:21" status="delivered" reactions={[{ emoji: '❤️', count: 2 }]} />
        <ChatBubble side="sent" text="This one didn't make it" time="09:22" status="failed" retryAction={() => {}} />
        <ChatBubble side="sent" text="Forwarded on" time="09:24" forwarded />
        <ChatBubble side="sent" text="Typo fixed" time="09:25" edited />
        <ChatBubble side="sent" text="" time="09:26" deleted />
        <ChatBubble side="sent" text="Yes — Thursday works for me" time="09:27" quoteName="Lucy" quoteText="Moved the review to Thursday." reactions={S.reactions} />
        <VoiceMessage side="sent" elapsed="0:00" total="0:41" time="09:30" />
      </div>
    </Frame>
  </div>
</Section>

<Section {...sec(features, 'rich-messages')}>
  <div class="grid2">
    <Frame label="Media & files">
      <div class="thread">
        <MediaMessage kind="album" side="received" items={S.album} caption="Offsite photos" time="11:02" />
        <MediaMessage kind="image" side="received" items={S.wide} time="11:03" />
        <div class="end"><MediaMessage kind="image" side="sent" items={S.upload} time="11:04" upload={{ state: 'uploading', progress: 0.42 }} /></div>
        <FileMessage side="received" fileName="tokens-v3.pdf" size="1.4 MB" time="11:05" />
        <div class="end"><FileMessage side="sent" fileName="release-notes.md" size="12 KB" time="11:06" upload={{ state: 'uploading', progress: 0.6, sent: '7 KB' }} /></div>
        <LinkPreview side="received" text="Spec is here https://oc.app/design" url="https://oc.app/design" domain="oc.app" title="OpenChat design system" description="Tokens, components and patterns for every OpenChat surface." imageBg="var(--cover-teal)" time="11:07" />
        <div class="end"><LinkPreview side="sent" size="compact" text="https://internetcomputer.org" url="https://internetcomputer.org" domain="internetcomputer.org" title="Internet Computer" imageBg={null} time="11:08" /></div>
      </div>
    </Frame>
    <Frame label="Crypto & governance">
      <div class="thread">
        <TransferMessage side="received" amount="12.5" symbol="ICP" mark={S.icp.mark} gradient={S.icp.gradient} usd="$68.50" caption="For lunch 🍜" time="12:01" />
        <div class="end"><TransferMessage side="sent" amount="100" symbol="CHAT" mark={S.chat.mark} gradient={S.chat.gradient} usd="$5.30" time="12:02" /></div>
        <SwapOfferMessage side="received" give={S.swapLegs.give} get={S.swapLegs.get} expiresIn="9d 21h" time="12:03" />
        <PollMessage side="received" question={S.poll.question} options={S.poll.options} publicVotes endsIn="2d" myVotes={[1]} time="12:04" />
        <PrizeMessage token={S.prizeToken} winners={20} claimed={7} endsIn="4m 12s" endingSoon gates={[{ label: 'docs.features.prize.diamondMember', met: true }, { label: 'docs.features.prize.hold10Chat', met: true }]} time="12:05" />
        <PrizeMessage token={S.prizeToken} winners={10} claimed={2} endsIn="1h 03m" gates={[{ label: 'docs.features.prize.diamondMember', met: true }, { label: 'docs.features.prize.hold1000Chat', met: false }]} time="12:06" />
        <ProposalMessage title="Fund the design system work" kind="Transfer SNS treasury funds" proposer="hamish" adopt={41} reject={6} when="docs.features.proposal.votingEnds" canVote time="12:07" />
      </div>
    </Frame>
  </div>
  <Frame label="Call events · single · grouped · missed" style="flex-direction: column; align-items: stretch;">
    <CallEvent state="live" media="video" startedBy="Lucy" faces={S.faces} elapsed="12:04" time="13:00" />
    <CallEvent state="ended" media="voice" startedBy="You" duration="4:12" time="13:20" />
    <CallEvent calls={S.groupedCalls} />
    <CallEvent state="missed" media="video" startedBy="Matt" time="14:02" />
  </Frame>
</Section>

<Section {...sec(features, 'emoji-picker')}>
  <Frame>
    <EmojiPicker selected={picked} onPick={(e) => (picked = picked.includes(e) ? picked.filter((x) => x !== e) : [...picked, e])} />
  </Frame>
</Section>

<Section {...sec(features, 'message-composer')}>
  <div class="grid2">
    <Frame label="Default"><div class="fill"><MessageComposer demo="idle" /></div></Frame>
    <Frame label="Typing"><div class="fill them"><ComposerBar typingNames={['Danielle', 'Priya']} /></div></Frame>
    <Frame label="Reply"><div class="fill"><MessageComposer context={{ key: 'r', mode: 'reply', name: 'Lucy', quote: 'Moved the review to Thursday.' }} /></div></Frame>
    <Frame label="Edit"><div class="fill"><MessageComposer context={{ key: 'e', mode: 'edit', quote: 'Typo fixd', text: 'Typo fixd' }} /></div></Frame>
    <Frame label="Recording"><div class="fill"><MessageComposer demo="recording" /></div></Frame>
    <Frame label="Preview"><div class="fill"><MessageComposer attachment={S.mediaTray} /></div></Frame>
  </div>
</Section>

<Section {...sec(features, 'navigation')}>
  <Frame label="NavRail · collapsed · expanded">
    <div class="rail">
      <NavRail items={S.navRail.items} pins={S.navRail.pins} activeIndex={navActive} onSelect={(i) => (navActive = i)} profileLabel="James Smith" profileHandle="@james" chitShown chitStreak={12} chitClaimable />
    </div>
    <div class="rail">
      <NavRail expanded items={S.navRail.items} pins={S.navRail.pins} activeIndex={navActive} onSelect={(i) => (navActive = i)} profileLabel="James Smith" profileHandle="@james" chitShown chitStreak={12} chitClaimable />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'panel-blocks')}>
  <div class="grid2">
    <Frame label="PanelCover · TileButtons">
      <div class="fill stack">
        <PanelCover cover="var(--cover-violet)" actions={['close']} trailActions={['favourite', 'more']} />
        <TileButtons tiles={['video', 'mute', 'search']} handlers={{ video: () => tileTaps++ }} />
        <TileButtons tiles={['members', 'everyone', 'pin', 'search']} columns={4} />
      </div>
    </Frame>
    <Frame label="PanelNavRow · StatCard">
      <div class="fill stack">
        <PanelNavRow label="docs.features.panel.members" value="112" />
        <PanelNavRow label="docs.features.panel.accessGates" hint="docs.features.panel.whoCanJoin" value="2" />
        <PanelNavRow label="docs.features.panel.upgradeDiamond" highlight />
        <div class="stats">
          <StatCard label="docs.features.panel.messages" value="1,417" />
          <StatCard label="docs.features.panel.membersCaps" value="112" />
          <StatCard label="CHIT" value="339,400" emphasis />
        </div>
      </div>
    </Frame>
  </div>
  <Frame label="StatsDonut">
    <div class="fill"><StatsDonut onlineMinutes={2942} onlineMinutesPrev={3965} slices={donut.slices} extras={donut.extras} /></div>
  </Frame>
</Section>

<Section {...sec(features, 'empty-error')}>
  <Frame cols={280}>
    <EmptyState preset="no-conversations" />
    <EmptyState preset="no-results" />
    <EmptyState preset="no-members" />
    <EmptyState preset="offline" />
    <EmptyState preset="error" />
  </Frame>
</Section>

<Section {...sec(features, 'density-overflow')}>
  <div class="grid2">
    <Frame label="Rows">
      <div class="stack">
        <ChatRow title={S.longName} preview="An unreasonably long preview line that keeps going well past the edge of the row so it has to truncate" time="23:59" color="amber" unreadCount={9999} verified online />
        <ChatRow title={S.longGroup} kind="group" preview="x" time="Mon" color="violet" unreadCount={9999} pinned muted />
        <ChatRow title="A" preview="." time="1m" color="teal" unreadCount={1} />
        <MemberRow title={S.longName} subtitle="@bartholomew_montgomery_fitzgerald_the_third" tag="docs.features.panel.owner" online activity="now" />
        <MemberRow title="Q" subtitle="@q" isYou />
      </div>
    </Frame>
    <Frame label="Bubbles">
      <div class="thread">
        <ChatBubble side="received" text="k" time="00:00" lastInGroup={false} />
        <ChatBubble side="received" text="?" time="00:00" reactions={[{ emoji: '👍', count: 9999 }, { emoji: '😂', count: 1 }, { emoji: '🔥', count: 42 }, { emoji: '❤️', count: 7 }, { emoji: '👀', count: 3 }]} />
        <ChatBubble side="sent" text="." time="00:01" />
        <ChatBubble side="sent" text="Supercalifragilisticexpialidocious_with_no_spaces_at_all_https://oc.app/a/really/long/link/that/never/breaks/naturally" time="00:02" />
        <ChatBubble side="received" text="Reply to a long one" time="00:03" quoteName={S.longName} quoteText={S.longGroup} />
      </div>
    </Frame>
  </div>
</Section>

<Section {...sec(features, 'wallet-blocks')}>
  <div class="grid2">
    <Frame label="BalanceCard">
      <div class="fill">
        <BalanceCard amount="$28,955.41" fiat="≈ 5,284 ICP" {veiled} onToggleVeil={() => (veiled = !veiled)} onRefresh={() => {}} allocation={S.allocation} onSend={() => {}} onReceive={() => {}} onSwap={() => {}} />
      </div>
    </Frame>
    <Frame label="TokenCoin · sizes" align="center">
      {#each S.walletCoins as c, i}
        <TokenCoin symbol={c.symbol} mark={c.mark} gradient={c.gradient} size={[64, 48, 36, 28][i] ?? 28} />
      {/each}
    </Frame>
  </div>
</Section>

<!-- App group, part B: the assembled patterns (list header → message group), call, daily puzzle, token coin,
     threads and the dialogs opened from buttons. -->

<Section {...sec(features, 'pattern-list-header')}>
  <Frame cols={320}>
    <div class="strip"><ChatListHeader kind="dms" title="ui.chatListHeader.chats" /></div>
    <div class="strip">
      <ChatListHeader kind="community" title="OpenChat Devs" visibility="Public" memberCount={2481} color="amber" menuItems={headerMenu} />
    </div>
    <div class="strip">
      <ChatListHeader kind="community" title="Design Guild" visibility="Private" memberCount={112} color="violet" menuItems={headerMenu} />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-chat-list')}>
  <Frame cols={300}>
    <div class="panel" style:height="560px">
      <ChatListPanel rows={[...patternRows]} headerKind="dms" headerTitle="ui.chatListHeader.chats" searchable showThreads threadCount={2} />
    </div>
    <div class="panel" style:height="560px">
      <ChatListPanel rows={[...patternRows]} headerKind="community" headerTitle="OpenChat Devs" headerMembers={2481} headerColor="amber" loading showThreads={false} />
    </div>
    <div class="panel" style:height="560px">
      <ChatListPanel rows={[]} headerKind="dms" headerTitle="ui.chatListHeader.chats" showThreads={false} emptyPreset="no-conversations" />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-header')}>
  <Frame cols="minmax(0, 1fr)">
    <div class="strip"><ConversationHeader title="Danielle Moreau" kind="user" color="violet" online presence="ui.conversationHeader.online" statusFav isFavourite /></div>
    <div class="strip">
      <ConversationHeader title="The Awesome Group" kind="group" color="teal" visibility="Public" memberCount={248} statusMuted="8h" statusEveryone actions={['search', 'threads'] as ComponentProps<typeof ConversationHeader>['actions']} />
    </div>
    <div class="strip">
      <ConversationHeader title="announcements" kind="channel" color="amber" visibility="Private" memberCount={2481} titleChevron titleHint="OpenChat Devs" showCall={false} panelOpen />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-info-panel')}>
  <Frame cols={320}>
    <div class="panel" style:height="900px">
      <InfoPanel kind="user" title="Alice Anderson" handle="@alice_anderson" verified online color="violet" details={infoDetails as ComponentProps<typeof InfoPanel>['details']} footerLabel="docs.features.info.report" />
    </div>
    <div class="panel" style:height="900px">
      <DmPanel
        title="Alice Anderson"
        handle="@alice_anderson"
        about="Product designer at OpenChat. Building onboarding flows, mostly. Coffee first, replies second."
        color="violet"
        online
        memberSince="Nov 2021"
        chit="339,400"
        disappearOn
        onMuteChange={async () => {}}
        onToggleFavourite={async () => {}}
        onBlock={async () => {}}
        onUnblock={async () => {}}
      />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-group-panel')}>
  <Frame cols="minmax(0, 400px) minmax(0, 340px)" style="justify-content: center">
    <div class="panel" style:height="720px">
      <GroupPanel {...groupPanel} title="The Awesome Group" memberTotal={18} storageKey="oc.docs.groupPanel.view" />
    </div>
    <div class="panel" style:height="720px">
      <GroupStats {...groupStats} />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-dividers')}>
  <Frame label="Opens pinned to the newest message">
    <div class="dividers" bind:this={thread} role="region" aria-label="Thread">
      {#each dividerThread as item}
        {#if 'divider' in item}
          <UnreadDivider label={item.divider} tone={item.tone} />
        {:else}
          <MessageGroup side={item.side} senderName={item.name ?? 'You'} color={item.color} messages={item.messages} />
        {/if}
      {/each}
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pattern-message-group')}>
  <Frame cols={380}>
    <div class="col">
      <MessageGroup side="received" senderName="Danielle Moreau" color="violet" messages={received} recentReactions={['❤️', '👍', '🔥', '😂']} onReact={(i, e) => toggle(received, i, e)} />
    </div>
    <div class="col">
      <MessageGroup side="sent" senderName="You" messages={sentGroup} />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'app-call')}>
  <Frame>
    <div class="call" style:width="420px" style:height="440px">
      <CallPanel title="Julian Jelfs" people={callPeople} start={Date.now() - 754000} onToggleCamera={() => {}} onToggleShare={() => {}} />
    </div>
  </Frame>
  <Frame align="center" style="justify-content: center">
    {#each tiles as t}
      <div class="tile-box" style:aspect-ratio={t.box} style:width={t.w}>
        <div class="tile"><VideoTile nameLabel={t.nameLabel} ratio={t.ratio} grad={t.grad} muted={t.muted} speaking={t.speaking} /></div>
      </div>
    {/each}
  </Frame>
  <Frame label="Drag the call to a corner">
    <div class="stage">
      <MiniCall title="Julian Jelfs" people={callPeople} start={Date.now() - 754000} />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'app-daily-puzzle')}>
  <Frame cols={360}>
    <DailyPuzzleCard state="new" countdown="10:10:10" {remind} onAction={(k) => k.startsWith('puzzleRemind') && (remind = k === 'puzzleRemindOn')} />
    <DailyPuzzleCard state="progress" sub="docs.features.puzzle.progress" countdown="10:10:10" />
    <DailyPuzzleCard state="solved" sub="docs.features.puzzle.solved" countdown="10:10:10" />
  </Frame>
</Section>

<Section {...sec(features, 'app-token-coin')}>
  <Frame align="center" style="justify-content: center; gap: 32px">
    {#each coins as c}
      <TokenCoin {...c} />
    {/each}
  </Frame>
</Section>

<Section {...sec(features, 'app-threads')}>
  <Frame cols="minmax(0, 325px) minmax(0, 370px)" style="justify-content: center">
    <div class="panel" style:height="620px">
      <ThreadList groups={threadGroups} />
    </div>
    <div class="panel" style:height="620px">
      <ThreadPanel chatName="The Awesome Group" threadKey="scale" root={threadRoot} replies={threadReplies} faces={threadFaces} {following} onFollowChange={(on) => {
        following = on;
      }} />
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'app-dialogs')}>
  <Frame label="Try it · opens the real overlay">
    <Button variant="secondary" label="docs.features.dialogs.joinGate" onClick={() => (dialog = 'join')} />
    <Button variant="secondary" label="docs.features.dialogs.pollBuilder" onClick={() => (dialog = 'poll')} />
    <Button variant="secondary" label="docs.features.dialogs.dailyPuzzle" onClick={() => (dialog = 'puzzle')} />
    <span class="actions-trigger" bind:this={trigger}>
      <Button variant="secondary" label="docs.features.dialogs.messageActions" onClick={openActions} />
    </span>
  </Frame>
  {#if dialog === 'join'}
    <JoinGateDialog {...joinGate as unknown as ComponentProps<typeof JoinGateDialog>} chatBalance={60501} recheckDays={84} onClose={() => (dialog = '')} onJoin={() => {
      dialog = '';
    }} />
  {:else if dialog === 'poll'}
    <PollBuilderDialog onClose={() => (dialog = '')} onPublish={() => {
        dialog = '';
      }} />
  {:else if dialog === 'puzzle'}
    <PuzzleDialog {...S.puzzleDemo} tutorialSeen puzzleStreak={4} balance={102000} countdown="10:57:11" onClose={() => (dialog = '')} />
  {/if}
  <MessageActions open={!!actionsAt} point={actionsAt} items={[...messageActionItems]} recent={['❤️', '👍', '🔥', '😂']} onReact={() => (actionsAt = null)} onClose={() => (actionsAt = null)} />
</Section>


{#snippet live(name: string, label: string = name, height: string | null = null)}
  {@const C = featureComponents[name]}
  {@const size = previewSize(name)}
  <Frame {label} style="justify-content: center">
    <div class="screen" style:width="min(100%, {size.width})" style:height={height ?? size.height}>
      <svelte:boundary>
        <C {...demoProps(name)} />
        {#snippet failed(e)}<pre class="demo-error">{String((e as Error)?.message ?? e)}</pre>{/snippet}
      </svelte:boundary>
    </div>
  </Frame>
{/snippet}

{#snippet openers(names: string[])}
  <Frame label="Try it · opens the real dialog">
    {#each names as n}<Button variant="secondary" label={dialogLabel(n)} onClick={() => (openDialog = n)} />{/each}
  </Frame>
{/snippet}

<Section {...sec(features, 'features-wallet')}>
  <div class="wallet">
    {@render live('WalletPanel', 'WalletPanel · side panel')}
    <Frame label="Wallet screens" style="flex-direction: column; flex-wrap: nowrap">
      <SegmentedTabs labels={walletTabs} selectedIndex={walletScreen} dotOnLast={false} onSelect={(i) => (walletScreen = i)} />
      {#key walletScreen}
        {@const C = featureComponents[walletScreens[walletScreen]]}
        <div class="screen wide">
          <svelte:boundary>
            <C {...demoProps(walletScreens[walletScreen])} />
            {#snippet failed(e)}<pre class="demo-error">{String((e as Error)?.message ?? e)}</pre>{/snippet}
          </svelte:boundary>
        </div>
      {/key}
    </Frame>
  </div>
</Section>

<Section {...sec(features, 'features-wallet-dialogs')}>
  {@render openers(['WalletSettingsDialog', 'SendCryptoDialog', 'SwapOfferDialog', 'DiamondDialog', 'PrizeBuilderDialog'])}
</Section>

<Section {...sec(features, 'features-activity')}>
  {@render live('ActivityPanel')}
</Section>

<Section {...sec(features, 'features-access-gates')}>
  {@render live('UpgradeBanner', 'UpgradeBanner', 'auto')}
  <div class="pair">
    {@render live('AccessGates', 'AccessGates · list editor', 'auto')}
    {@render live('AccessGatesCards', 'AccessGatesCards · card picker', 'auto')}
  </div>
</Section>

<Section {...sec(features, 'features-explore')}>
  {@render live('ExploreCommunities', 'ExploreCommunities', 'auto')}
  {@render openers(['AuthDialog'])}
</Section>

<Section {...sec(features, 'features-people')}>
  {@render live('DmChatSettings', 'DmChatSettings', 'auto')}
  {@render openers(['ProfileDialog', 'UserDialog'])}
</Section>

<Section {...sec(features, 'features-group-dialogs')}>
  {@render openers(['CreateGroupDialog', 'GroupSettingsDialog', 'NewChannelDialog', 'ConvertToCommunityDialog', 'ImportToCommunityDialog', 'UserGroupDialog', 'InviteDialog', 'WebhookDialog', 'BotDialog', 'LeaveGroupDialog', 'DeleteGroupDialog'])}
</Section>

<Section {...sec(features, 'features-rewards')}>
  <Frame label="AchievementToast · try it" align="center" style="flex-direction: column; flex-wrap: nowrap">
    <div class="screen contain toast-stage">
      {#if toast}
        {#key toast}
          {@const a = achievements[(toast - 1) % achievements.length]}
          <AchievementToast title={a.title} icon={a.icon} reward={a.reward} onDone={() => (toast = 0)} />
        {/key}
      {/if}
    </div>
    <Button variant="secondary" label={toast ? 'docs.features.achievements.playAgain' : 'docs.features.achievements.unlock'} onClick={() => (toast = toastRuns += 1)} />
  </Frame>
  {@render openers(['AchievementsDialog', 'ChitDialog', 'ClaimHistoryDialog', 'StreakInsuranceDialog', 'LeaderboardDialog', 'MemeFighterDialog'])}
</Section>

<Section {...sec(features, 'pages-landing')}>
  <Frame label="Landing · scrolls inside the frame; sign in / create account open the real dialog" style="justify-content: center">
    <!-- only stops the page's link clicks, which keep their own keyboard handling -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="screen page-frame" onclick={keepLinksInFrame}>
      <svelte:boundary>
        <Landing {...demoProps('Landing')} {mode} {accent} />
        {#snippet failed(e)}<pre class="demo-error">{String((e as Error)?.message ?? e)}</pre>{/snippet}
      </svelte:boundary>
    </div>
  </Frame>
</Section>

<Section {...sec(features, 'pages-learn')}>
  <Frame label="Learn · routed by the host (page / post / onNavigate)" style="justify-content: center">
    <!-- only stops the page's link clicks, which keep their own keyboard handling -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="screen page-frame" onclick={keepLinksInFrame}>
      <svelte:boundary>
        <Learn
          {...demoProps('Learn')}
          {mode}
          {accent}
          page={learnPage}
          post={learnPost}
          learnPageHref={() => '#'}
          onNavigate={(p: LearnPage, post?: string) => {
            learnPage = p;
            learnPost = post;
          }}
        />
        {#snippet failed(e)}<pre class="demo-error">{String((e as Error)?.message ?? e)}</pre>{/snippet}
      </svelte:boundary>
    </div>
  </Frame>
</Section>

{#if openDialog}
  {@const D = featureComponents[openDialog]}
  <svelte:boundary>
    <D {...demoProps(openDialog)} onClose={() => (openDialog = null)} onCancel={() => (openDialog = null)} />
    {#snippet failed(e)}<pre class="demo-error dialog-error">{String((e as Error)?.message ?? e)}</pre>{/snippet}
  </svelte:boundary>
{/if}

<style>
  .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .stack { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }
  .fill { width: 100%; min-width: 0; }
  .cap { margin-top: 6px; font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-4); }
  .cap:first-child { margin-top: 0; }
  .force-hover :global(.row) { background: var(--overlay-1); }

  .thread { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; min-width: 0; }
  .thread.sent { align-items: flex-end; }
  .thread > :global(*) { max-width: 100%; }
  .end { align-self: flex-end; }

  .them { padding-inline-start: 4px; box-sizing: border-box; }
  .rail { height: 820px; display: flex; outline: 1px dashed var(--line-2); outline-offset: 4px; border-radius: 4px; }
  .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
  .strip { min-width: 0; border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-0); box-shadow: inset 0 0 0 1px var(--line-1); }
  .panel { min-width: 0; border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-1); box-shadow: 0 0 0 1px var(--line-1); }
  .col { min-width: 0; }
  .dividers { box-sizing: border-box; width: 100%; height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 4px 4px 8px; outline: none; }
  .call { max-width: 100%; border-radius: var(--radius-lg); overflow: hidden; }
  .tile-box { position: relative; min-width: 0; }
  .tile { position: absolute; inset: 0; }
  .stage { position: relative; width: 100%; height: 420px; border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-0); box-shadow: inset 0 0 0 1px var(--line-1); }
  .actions-trigger { display: inline-flex; }
  /* stacked: side by side the screens frame got ~646px at most (never the wide layout) and collapsed on narrow pages */
  .wallet { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; }
  .screen { position: relative; min-width: 0; max-width: 100%; display: grid; grid-template-columns: minmax(0, 1fr); }
  /* transform: a fixed-position toast is laid out inside its frame, not the viewport */
  .screen.contain { transform: translateZ(0); }
  .toast-stage { width: 100%; height: 96px; }
  .screen.wide { width: 100%; height: 800px; }
  /* the pages are full-height screens: they scroll inside the frame, so their sticky headers stick to it */
  .page-frame { display: block; width: 100%; height: 760px; overflow: auto; border-radius: var(--radius-lg); box-shadow: inset 0 0 0 1px var(--line-1); }
  .demo-error { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--status-danger-soft); color: var(--status-danger); font: 500 12px/1.5 var(--font-mono); white-space: pre-wrap; }
  .dialog-error { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; z-index: var(--z-modal); }
</style>
