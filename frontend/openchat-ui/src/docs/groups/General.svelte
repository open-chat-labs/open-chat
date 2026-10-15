<!-- General: product-agnostic components, one <Section> per entry in sections.ts `general`. Demo data in samples.ts. -->
<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Section from '../Section.svelte';
  import Frame from '../Frame.svelte';
  import { general, sec } from '../sections';
  import {
    samples, contextMenuItems as rowMenu, menuDemo, sortMenu, contextRows, pickerTokens, tokenIcp, tokenChat,
    tokenBtc, transactions, stackPeople, thresholds, timelineRunning, timelineDone, timelineFailed, sortableStart,
  } from '../samples';
  import { ICONS } from '../../lib/icons.js';
  import { useT } from '../../lib/i18n';
  import {
    Avatar, Badge, UserChip, MemberRow, Button, IconButton, Field, TextArea, Toggle, TimedToggle, SegmentedTabs,
    DurationChips, Menu, ChatRow, ChatPicker, Tooltip, Skeleton, Banner, UndoToast, Spinner, Pill, ListSectionLabel,
    CopyButton, TokenAvatar, TokenPicker, AmountCard, AvatarStack, Confetti, Countdown, DetailRow, DetailSection,
    DialogShell, PageHeader, ProgressTimeline, QuickAmountChips, RequirementChip, RoundIconButton, ShareBar, SideCard,
    SnapFloat, SortableInputList, StepIndicator, ThresholdBar, TransactionRow, Waveform,
  } from '../../lib/index';

  // demo copy is translated like product copy: keys for copy props, t() for props the component treats as data
  const t = useT();

  const icons = Object.keys(ICONS).sort();
  const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
  const states = ['default', 'hover', 'focus', 'active', 'disabled'] as const;
  const colors = ['violet', 'blue', 'teal', 'amber', 'plum'] as const;
  const badges = ['send', 'receive', 'swap'] as const;

  // inputs & controls
  let search = $state('');
  let bio = $state('Designer at OpenChat. Ask me about tokens.');
  let notify = $state(true);
  let tab = $state(0);
  let duration = $state('1 day');

  // user chips
  let chips = $state(['Alice Anderson', 'Lucy Linden', 'Priya Raman']);

  // chat picker
  let pickerOpen = $state(false);

  // banners
  let toastShown = $state(true);

  // ── GeneralB ──
  // demo state
  let dialogOpen = $state(false);
  let payValue = $state('120');
  let quickPicked = $state<number | null>(null);
  let muted = $state(false);
  let camera = $state(true);
  let progress = $state(0.35);
  let playing = $state(false);
  let snapped = $state('br');
  let celebrate = $state(0);
  let celebrateSm = $state(0);
  let sortable = $state<string[]>([...sortableStart]);
  let step = $state(1);

  // countdown targets, fixed once per page load
  const now = Date.now();
  const inDays = now + 2 * 86400e3 + 4 * 3600e3;
  const inHours = now + 3 * 3600e3 + 12 * 60e3;
  const inMinutes = now + 4 * 60e3 + 9e3;
  const ended = now - 60e3;

  // play the waveform: advance progress until the end, then stop
  $effect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      progress = Math.min(1, progress + 0.01);
      if (progress >= 1) playing = false;
    }, 80);
    return () => clearInterval(timer);
  });

  const fmtFraction = (f: number) => (f === 1 ? 'Max' : Math.round(f * 100) + '%');
</script>

<!-- General, part A: icons … token avatars. Live library components with fixed demo props. -->

<Section {...sec(general, 'icons')}>
  <Frame label="{icons.length} glyphs · 24×24 · stroke follows currentColor">
    <div class="icons">
      {#each icons as name}
        <div class="icon-cell" title={name}>
          <span class="glyph" style:mask="var(--icon-{name}) center/contain no-repeat" style:-webkit-mask="var(--icon-{name}) center/contain no-repeat"></span>
          <span class="mono">{name}</span>
        </div>
      {/each}
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'avatars-badges')}>
  <div class="grid2">
    <Frame label="Avatar · size · shape · online" align="end">
      {#each [28, 34, 42, 56, 72] as size, i}
        <Avatar {size} color={colors[i]} online={i % 2 === 0} />
      {/each}
      {#each [34, 42] as size, i}
        <Avatar {size} shape="squircle" color={colors[i + 2]} />
      {/each}
    </Frame>
    <Frame label="Badge · variants" align="center">
      <Badge variant="count" label="3" />
      <Badge variant="count" label="128" />
      <Badge variant="tag" label="docs.general.badges.admin" />
      <Badge variant="neutral" label="docs.general.badges.bot" />
      <Badge variant="chit" label="1,250" />
      <Badge variant="chit" label="1.2k" short />
      <Badge variant="dot" />
      <Badge variant="verified" />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'user-chips')}>
  <div class="grid2">
    <Frame label="Size · variant" align="center">
      <UserChip label="Alice" size="sm" color="violet" />
      <UserChip label="Alice Anderson" size="md" color="teal" online />
      <UserChip label="Alice Anderson" size="lg" color="amber" tag="docs.general.people.owner" />
      <UserChip label={t('docs.general.people.pending')} variant="accent" showAvatar={false} />
      <UserChip label={t('docs.general.people.blocked')} variant="danger" color="slate" />
    </Frame>
    <Frame label="Try it · removable" align="center">
      {#each chips as name (name)}
        <UserChip label={name} color="blue" showRemove onRemove={() => (chips = chips.filter((c) => c !== name))} />
      {/each}
      {#if !chips.length}
        <Button label="docs.general.people.reset" variant="secondary" onClick={() => (chips = ['Alice Anderson', 'Lucy Linden', 'Priya Raman'])} />
      {/if}
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'user-cards')}>
  <div class="grid2">
    <Frame label="Members" style="flex-direction: column; flex-wrap: nowrap; gap: 0" align="stretch">
      <MemberRow title="Jane Smith" subtitle="@jane_smith" tag="docs.general.people.owner" color="violet" online activity="now" />
      <MemberRow title={t('docs.general.people.you')} subtitle="@you" isYou color="teal" />
      <MemberRow title="Priya Raman" subtitle="@priya_raman" color="amber" activity="typing" online />
      <MemberRow title="Tom Beckett" subtitle="@tom_beckett" muted badge="docs.general.people.pending" color="blue" />
      <MemberRow title="docs.general.people.invitePeople" variant="invite" />
    </Frame>
    <Frame label="Bots · webhooks · pickers" style="flex-direction: column; flex-wrap: nowrap; gap: 0" align="stretch">
      <MemberRow title="ReminderBot" subtitle="Schedules reminders for the group and pings people when it's time." variant="bot" actionLabel="ui.common.add" onAction={() => {}} />
      <MemberRow title="GitHub releases" subtitle="Posts a message for each release" variant="webhook" showMenu onMenu={() => {}} />
      <MemberRow title="Lucy Linden" subtitle="@lucy_linden" color="teal" icon="toggle" selected />
      <MemberRow title="Robert Lang" subtitle="@robert_lang" color="slate" icon="toggle" disabled />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'buttons')}>
  <div class="grid2">
    <Frame label="Button · variant" align="center">
      <Button label="docs.general.buttons.primary" />
      <Button label="docs.general.buttons.secondary" variant="secondary" />
      <Button label="docs.general.buttons.ghost" variant="ghost" />
      <Button label="ui.common.delete" variant="danger" />
      <Button label="docs.general.buttons.disabled" disabled />
      <div class="full"><Button label="docs.general.buttons.fullWidth" fullWidth /></div>
    </Frame>
    <Frame label="IconButton · variant · pressed" align="center">
      <IconButton icon="search" label="ui.common.search" />
      <IconButton icon="more" label="ui.common.more" variant="ghost" />
      <IconButton icon="more" label="docs.general.buttons.moreOpen" variant="ghost" pressed />
      <IconButton icon="plus" label="docs.general.buttons.newChat" variant="accent" />
      <div class="on-cover"><IconButton icon="close" label="ui.common.close" variant="overlay" /></div>
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'button-states')}>
  <Frame>
    <div class="states">
      <span></span>
      {#each states as s}<span class="mono head">{s.toUpperCase()}</span>{/each}
      {#each variants as v}
        <span class="mono row-label">{v}</span>
        {#each states as s}
          <div class="cell">
            {#if s === 'disabled'}
              <Button label="docs.general.buttons.button" variant={v} disabled />
            {:else}
              <Button label="docs.general.buttons.button" variant={v} state={s} />
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'inputs-controls')}>
  <div class="grid2">
    <Frame label="Field · TextArea" style="flex-direction: column; flex-wrap: nowrap" align="stretch">
      <Field placeholder="docs.general.inputs.searchChats" shortcut="⌘K" />
      <Field placeholder="docs.general.inputs.searchPeople" value={search} onInput={(e) => (search = e.currentTarget.value)} onClear={() => (search = '')} />
      <TextArea value={bio} placeholder="docs.general.inputs.aboutYou" maxLength={120} help="docs.general.inputs.aboutHelp" onInput={(e) => (bio = e.currentTarget.value)} />
      <TextArea value="" placeholder="docs.general.inputs.groupName" error errorText="docs.general.inputs.nameRequired" />
    </Frame>
    <Frame label="Toggle · TimedToggle · DurationChips" style="flex-direction: column; flex-wrap: nowrap" align="stretch">
      <Toggle on={notify} label="docs.general.inputs.notifications" help="docs.general.inputs.notificationsHelp" onChange={(v) => (notify = v)} />
      <Toggle on={false} label="docs.general.buttons.disabled" disabled />
      <TimedToggle label="docs.general.inputs.disappearing" on value="1 day" options={['1 hour', '1 day', '1 week']} prefix="ui.timedToggle.after" />
      <DurationChips title="docs.general.inputs.muteFor" hint="docs.general.inputs.muteHint" value={duration} options={['1 hour', '8 hours', '1 day', '1 week', 'ui.timedToggle.always']} onChange={(v) => (duration = v)} />
    </Frame>
    <div class="span"><Frame label="SegmentedTabs" style="flex-direction: column; flex-wrap: nowrap" align="stretch">
      <SegmentedTabs labels={['docs.general.tabs.all', 'docs.general.tabs.direct', 'docs.general.tabs.groups', 'docs.general.tabs.unread']} selectedIndex={tab} onSelect={(i) => (tab = i)} />
      <SegmentedTabs labels={['docs.general.tabs.members', 'docs.general.tabs.bots', 'docs.general.tabs.invited']} counts={[112, 3, 8]} selectedIndex={0} dotOnLast />
    </Frame></div>
  </div>
</Section>

<Section {...sec(general, 'menus')}>
  <div class="grid3">
    <Frame label="Icons · shortcuts · danger"><Menu items={menuDemo} /></Frame>
    <Frame label="Heading · selected"><Menu heading="docs.general.menus.sortBy" items={sortMenu} /></Frame>
    <Frame label="Row menu"><Menu items={rowMenu} /></Frame>
  </div>
</Section>

<Section {...sec(general, 'context-menu')}>
  <Frame label="Try it · right-click, hover ⋯ or long-press" style="flex-direction: column; flex-wrap: nowrap; gap: 2px; max-width: 420px" align="stretch">
    {#each contextRows as r}
      <ChatRow {...r} menuItems={rowMenu} />
    {/each}
  </Frame>
</Section>

<Section {...sec(general, 'chat-picker')}>
  <Frame label="Opens the real overlay">
    <Button label="docs.general.chatPicker.shareInviteLink" variant="secondary" onClick={() => (pickerOpen = true)} />
    {#if pickerOpen}
      <ChatPicker {...(samples.ChatPicker as unknown as ComponentProps<typeof ChatPicker>)} onSend={() => (pickerOpen = false)} onClose={() => (pickerOpen = false)} />
    {/if}
  </Frame>
</Section>

<Section {...sec(general, 'tooltip')}>
  <div class="grid2">
    <Frame label="Spec · placement" align="center" style="justify-content: center; padding-block: 34px">
      <div class="tip-demo"><Tooltip label="docs.general.tooltip.above" /></div>
      <div class="tip-demo"><Tooltip label="docs.general.tooltip.below" placement="bottom" /></div>
    </Frame>
    <Frame label="Try it · hover or focus" align="center" style="justify-content: center">
      <IconButton icon="search" label="ui.common.search" />
      <IconButton icon="bell" label="docs.general.inputs.notifications" />
      <IconButton icon="share" label="ui.common.share" />
      <span class="hint" title="Any element with a title gets the tooltip">Hover this text</span>
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'skeleton')}>
  <div class="grid2">
    <Frame label="chat" style="flex-direction: column; flex-wrap: nowrap" align="stretch"><Skeleton variant="chat" count={3} /></Frame>
    <Frame label="member" style="flex-direction: column; flex-wrap: nowrap" align="stretch"><Skeleton variant="member" count={3} /></Frame>
    <Frame label="token" style="flex-direction: column; flex-wrap: nowrap" align="stretch"><Skeleton variant="token" count={3} /></Frame>
    <Frame label="activity" style="flex-direction: column; flex-wrap: nowrap" align="stretch"><Skeleton variant="activity" count={3} /></Frame>
  </div>
</Section>

<Section {...sec(general, 'banners')}>
  <Frame label="Banner · tone" style="flex-direction: column; flex-wrap: nowrap" align="stretch">
    <Banner text="docs.general.banners.approval" actionLabel="docs.general.banners.review" actionHandler={() => {}} />
    <Banner tone="warning" text="docs.general.banners.storage" actionLabel="docs.general.banners.upgrade" actionHandler={() => {}} />
    <Banner tone="danger" text="docs.general.banners.reported" />
    <Banner tone="offline" text="docs.general.banners.offline" />
  </Frame>
  <Frame label="UndoToast · tone · size" style="flex-direction: column; flex-wrap: nowrap">
    <UndoToast message="docs.general.toasts.archived" actionLabel="ui.common.undo" onAction={() => {}} onClose={() => {}} />
    <UndoToast message="docs.general.toasts.linkCopied" tone="success" icon="check" />
    <UndoToast message="docs.general.toasts.deleted" size="lg" shown={toastShown} actionLabel="ui.common.undo" onAction={() => (toastShown = false)} onClose={() => (toastShown = false)} />
    {#if !toastShown}<Button label="docs.general.toasts.showAgain" variant="ghost" onClick={() => (toastShown = true)} />{/if}
  </Frame>
</Section>

<Section {...sec(general, 'loaders')}>
  <Frame label="Spinner · size · tone" align="center">
    {#each [14, 18, 24, 32] as size}<Spinner {size} />{/each}
    {#each [18, 24] as size}<Spinner {size} tone="ink" />{/each}
  </Frame>
</Section>

<Section {...sec(general, 'pills')}>
  <div class="grid2">
    <Frame label="sm · row statuses" align="center">
      <Pill label="docs.general.pills.pending" />
      <Pill label="docs.general.pills.active" tone="success" dot />
      <Pill label="docs.general.pills.expiring" tone="warning" />
      <Pill label="docs.general.pills.failed" tone="danger" />
      <Pill label="docs.general.pills.new" tone="accent" />
    </Frame>
    <Frame label="md · numbers" align="center">
      <Pill label="02:14:09" size="md" />
      <Pill label="+12.4%" size="md" tone="success" />
      <Pill label="−3.1%" size="md" tone="danger" />
      <Pill label="docs.general.pills.live" size="md" tone="accent" dot />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'section-labels')}>
  <Frame style="flex-direction: column; flex-wrap: nowrap; gap: 14px; max-width: 420px" align="stretch">
    <ListSectionLabel label="docs.general.sectionLabels.today" />
    <ListSectionLabel label="docs.general.tabs.members" meta="112" />
    <ListSectionLabel label="docs.general.amounts.youPay" meta={t('docs.general.amounts.balance', { amount: '0.5 ICP' })} inset />
  </Frame>
</Section>

<Section {...sec(general, 'copy-button')}>
  <div class="grid2">
    <Frame label="Sizes · try it, copies to the clipboard" style="flex-direction: column; flex-wrap: nowrap">
      <div class="tok-row"><span class="mono size-label">sm</span><CopyButton value="oc.app/group/the-awesome-group-8f2a" label="docs.general.copy.copyLink" size="sm" /></div>
      <div class="tok-row"><span class="mono size-label">md</span><CopyButton value="oc.app/group/the-awesome-group-8f2a" label="docs.general.copy.copyLink" size="md" /></div>
    </Frame>
    <Frame label="In context · beside the value it copies" style="flex-direction: column; flex-wrap: nowrap">
      {#each [{ k: 'docs.general.copy.principal', copy: 'docs.general.copy.copyPrincipal', v: 'eypkj-sqjl7-lhksa-5j6vq-cae' }, { k: 'docs.general.copy.inviteLink', copy: 'docs.general.copy.copyInviteLink', v: 'oc.app/group/the-awesome-group-8f2a' }] as f}
        <div class="copy-field">
          <span class="copy-key">{t(f.k)}</span>
          <span class="mono address">{f.v}</span>
          <CopyButton value={f.v} label={f.copy} size="sm" />
        </div>
      {/each}
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'token-avatars')}>
  <div class="grid2">
    <Frame label="TokenAvatar · size · activity badge" style="flex-direction: column; flex-wrap: nowrap">
      {#each [28, 40, 52] as size}
        <div class="tok-row">
          <span class="mono">{size}</span>
          {#each pickerTokens.slice(0, 5) as t}<TokenAvatar symbol={t.symbol} mark={t.mark} gradient={t.gradient} {size} />{/each}
        </div>
      {/each}
      <div class="tok-row">
        <span class="mono">badge</span>
        {#each badges as badge, i}
          <TokenAvatar symbol={pickerTokens[i].symbol} mark={pickerTokens[i].mark} gradient={pickerTokens[i].gradient} {badge} />
        {/each}
      </div>
    </Frame>
    <Frame label="TokenPicker">
      <div class="picker"><TokenPicker tokens={pickerTokens} /></div>
    </Frame>
  </div>
</Section>

<!-- General group, second half: page-header … progress-timeline. -->

<Section {...sec(general, 'page-header')}>
  <Frame cols="minmax(0, 1fr)">
    <PageHeader onBack={() => {}} title="docs.general.pageHeader.swapIcp" avatarMark={tokenIcp.mark} avatarGradient={tokenIcp.gradient}>
      <StepIndicator steps={['docs.general.steps.details', 'docs.general.steps.quote', 'docs.general.steps.swap']} current={1} />
    </PageHeader>
    <PageHeader onBack={() => {}} title="docs.general.pageHeader.sendChat" avatarMark={tokenChat.mark} avatarGradient={tokenChat.gradient}>
      <span class="trail">{t('docs.general.amounts.balance', { amount: '132.33 CHAT' })}</span>
    </PageHeader>
    <PageHeader onBack={() => {}} title="docs.general.pageHeader.receive" backLabel="docs.general.pageHeader.wallet" />
  </Frame>
</Section>

<Section {...sec(general, 'dialog-shell')}>
  <Frame label="Try it · opens the real overlay" align="center">
    <Button label="docs.general.dialog.open" variant="secondary" onClick={() => (dialogOpen = true)} />
    <span class="note">Esc, the close button or a click on the backdrop dismisses it; Tab stays inside.</span>
  </Frame>
  {#if dialogOpen}
    <DialogShell title="docs.general.dialog.renameGroup" width={420} height="auto" onClose={() => (dialogOpen = false)}>
      <div class="dialog-body">
        <p class="prose">DialogShell is the frame every dialog shares: blurred backdrop, a header with the title and close button, and a body from children.</p>
        <div class="dialog-actions">
          <Button label="ui.common.cancel" variant="ghost" onClick={() => (dialogOpen = false)} />
          <Button label="ui.common.save" onClick={() => (dialogOpen = false)} />
        </div>
      </div>
    </DialogShell>
  {/if}
</Section>

<Section {...sec(general, 'transaction-rows')}>
  <Frame cols="minmax(0, 1fr)" label="All activity · token badged with the kind">
    <div class="stack">
      {#each transactions as t, i}
        <TransactionRow {...t} divider={i > 0} onClick={() => {}} />
      {/each}
    </div>
  </Frame>
  <div class="pair">
    <Frame cols="minmax(0, 1fr)" label="Single token · neutral kind icon">
      <div class="stack">
        <TransactionRow title={t('docs.general.tx.receivedFrom', { name: 'Lucy Linden' })} sub="10:42" amount="+385.60 ICP" fiat="$2,113.47" kind="receive" />
        <TransactionRow title={t('docs.general.tx.sentTo', { name: 'Matt Rivers' })} sub={t('docs.general.tx.yesterday')} amount="−4.00 ICP" fiat="$21.92" kind="send" divider />
      </div>
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="Balances hidden">
      <div class="stack">
        <TransactionRow {...transactions[0]} fresh={false} hidden />
        <TransactionRow {...transactions[1]} hidden divider />
      </div>
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'detail-rows')}>
  <div class="pair">
    <Frame cols="minmax(0, 1fr)" label="DetailRow · tones, sizes, rules">
      <div class="stack">
        <DetailRow label="docs.general.details.youSend" value="100 CHAT" rule="none" />
        <DetailRow label="docs.general.details.rate" value="1 CHAT ≈ 0.0219 ICP" tone="muted" rule="none" />
        <DetailRow label="docs.general.details.priceImpact" value="−0.42%" tone="warning" rule="none" />
        <DetailRow label="docs.general.details.transferFee" value="0.0001 ICP" rule="top" />
        <DetailRow label="docs.general.details.depositAccount" value="5sj6i-pqaaa…a3cmq-cai" copyValue="5sj6i-pqaaa-aaaaf-a3cmq-cai" rule="none" size="sm" />
        <DetailRow label="docs.general.details.youReceive" value="+2.19425 ICP" tone="positive" size="lg" strong rule="top" />
      </div>
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="DetailSection · value and prose">
      <div class="stack gap">
        <DetailSection label="docs.general.details.memberSince" value="1 Nov 2021" />
        <DetailSection label="docs.general.details.status" value={t('docs.general.details.onlineNow')} dot />
        <DetailSection label="docs.general.details.chitEarned" value="339,400" highlight />
        <DetailSection
          label="docs.general.details.about"
          variant="prose"
          clamp={3}
          value="A place for product designers working on OpenChat to share work in progress, critique each other's flows, and keep the component library honest. Post screenshots early; the worst feedback is the one that arrives after the build. Weekly crit is on Thursdays at 16:00 UTC in the voice channel."
        />
      </div>
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'share-bars')}>
  <Frame cols="minmax(0, 1fr)">
    <div class="stack gap">
      {#each [{ t: tokenIcp, share: 71.4 }, { t: tokenChat, share: 22.9 }, { t: tokenBtc, share: 5.1 }, { t: tokenChat, share: 0.3 }] as row}
        <div class="share-row">
          <span class="code">{row.t.symbol} · {row.share}%</span>
          <ShareBar share={row.share} gradient={row.t.gradient} />
        </div>
      {/each}
      <div class="share-row">
        <span class="code">Thick · 4px</span>
        <ShareBar share={41.3} gradient={tokenIcp.gradient} thickness={4} />
      </div>
      <div class="share-row">
        <span class="code">Veiled (balances hidden)</span>
        <ShareBar share={71.4} gradient={tokenIcp.gradient} veiled />
      </div>
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'side-card')}>
  <div class="pair">
    <SideCard>
      <span class="label">{t('docs.general.sideCard.summary')}</span>
      <DetailRow label="docs.general.details.amount" value="12.00 CHAT" rule="none" />
      <DetailRow label="docs.general.details.networkFee" value="0.001 CHAT" rule="none" tone="muted" />
      <DetailRow label="docs.general.details.total" value="12.001 CHAT" rule="top" strong />
    </SideCard>
    <SideCard minHeight="200px">
      <span class="label">{t('docs.general.steps.quote')}</span>
      <DetailRow label="docs.general.details.bestRoute" value="ICPSwap" rule="none" />
      <DetailRow label="docs.general.details.youReceive" value="+2.19425 ICP" tone="positive" size="lg" strong rule="top" />
    </SideCard>
  </div>
</Section>

<Section {...sec(general, 'amount-card')}>
  <div class="pair">
    <Frame cols="minmax(0, 1fr)" label="Swap pair · top + bottom, editable">
      <div class="stack">
        <AmountCard label="docs.general.amounts.youPay" meta={t('docs.general.amounts.balance', { amount: '0.5 ICP' })} value={payValue} note="≈ $657.72" symbol="ICP" mark={tokenIcp.mark} gradient={tokenIcp.gradient} position="top" onChange={(e) => (payValue = e.currentTarget.value)} onQuickSelect={() => {}} onTokenClick={() => {}} />
        <AmountCard label="docs.general.amounts.youGet" value="2,412.6" note="≈ $127.87" symbol="CHAT" mark={tokenChat.mark} gradient={tokenChat.gradient} position="bottom" muted onTokenClick={() => {}} />
      </div>
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="Alone · over balance">
      <AmountCard label="docs.general.details.youSend" meta={t('docs.general.amounts.balance', { amount: '132.33 CHAT' })} value="150" note="docs.general.amounts.overBalance" tone="danger" symbol="CHAT" mark={tokenChat.mark} gradient={tokenChat.gradient} position="alone" onChange={() => {}} />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'quick-amounts')}>
  <Frame cols="minmax(0, 1fr)">
    <div class="row">
      <span class="code w">md</span>
      <QuickAmountChips onSelect={(f) => (quickPicked = f)} />
    </div>
    <div class="row">
      <span class="code w">sm</span>
      <QuickAmountChips size="sm" options={[0.1, 0.5, 1]} onSelect={(f) => (quickPicked = f)} />
    </div>
    <span class="note">{quickPicked == null ? 'Pick a chip' : 'Picked ' + fmtFraction(quickPicked) + ' of the balance'}</span>
  </Frame>
</Section>

<Section {...sec(general, 'avatar-stack')}>
  <Frame align="center" style="gap: 32px">
    <AvatarStack people={stackPeople.slice(0, 3)} />
    <AvatarStack people={stackPeople} max={4} />
    <AvatarStack people={stackPeople} max={5} size={34} initials />
    <AvatarStack people={stackPeople.slice(0, 4)} size={22} />
  </Frame>
</Section>

<Section {...sec(general, 'round-icon-button')}>
  <div class="pair">
    <Frame label="Variants" align="center">
      <RoundIconButton icon="mic" label="docs.general.call.mute" />
      <RoundIconButton icon="mic" label="docs.general.call.micOn" variant="on" />
      <RoundIconButton icon="camera" label="docs.general.call.cameraOff" variant="off" />
      <RoundIconButton icon="phone" label="docs.general.call.leaveCall" variant="danger" />
      <span class="overlay-bg"><RoundIconButton icon="mic-off" label="docs.general.call.unmute" variant="overlay" /></span>
    </Frame>
    <Frame label="Sizes · sm 34 · md 50 · lg 56 · try it" align="center">
      <RoundIconButton icon="mic" label={muted ? 'docs.general.call.unmute' : 'docs.general.call.mute'} size="sm" variant={muted ? 'off' : 'default'} pressed={muted} onPress={() => (muted = !muted)} />
      <RoundIconButton icon="camera" label={camera ? 'docs.general.call.cameraOff' : 'docs.general.call.cameraOn'} size="md" variant={camera ? 'default' : 'off'} pressed={!camera} onPress={() => (camera = !camera)} />
      <RoundIconButton icon="phone" label="docs.general.call.leaveCall" size="lg" variant="danger" />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'waveform')}>
  <Frame cols="minmax(0, 1fr)" label="Try it · click or drag to seek, arrow keys when focused">
    <div class="row">
      <RoundIconButton icon={playing ? 'pause-filled' : 'play-filled'} label={playing ? 'docs.general.waveform.pause' : 'docs.general.waveform.play'} size="sm" variant="on" onPress={() => { if (progress >= 1) progress = 0; playing = !playing; }} />
      <div class="grow"><Waveform count={48} seed={7} {progress} handle height={26} label="docs.general.waveform.voiceMessage" onSeek={(f) => (progress = f)} /></div>
      <span class="code">{Math.round(progress * 100)}%</span>
    </div>
  </Frame>
  <div class="pair">
    <Frame cols="minmax(0, 1fr)" label="Static · played part">
      <Waveform count={36} seed={3} progress={0.6} height={22} />
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="Short · not played">
      <Waveform count={24} seed={11} height={18} />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'snap-float')}>
  <Frame cols="minmax(0, 1fr)" label="Try it · drag the card; it snaps to the nearest corner or edge">
    <div class="snap-stage">
      <SnapFloat width={220} inset={16} position="br" label="docs.general.snapFloat.card" onSnap={(p) => (snapped = p)}>
        <div class="float-card">
          <span class="float-title">{t('docs.general.snapFloat.miniCall')}</span>
          <span class="code">Snapped · {snapped}</span>
        </div>
      </SnapFloat>
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'confetti')}>
  <Frame label="Try it" align="center" style="gap: 24px">
    <span class="burst">
      <Button label="docs.general.confetti.celebrate" onClick={() => celebrate++} />
      <Confetti fire={celebrate} />
    </span>
    <span class="burst">
      <Button label="docs.general.confetti.smallBurst" variant="secondary" onClick={() => celebrateSm++} />
      <Confetti fire={celebrateSm} count={30} spread={60} power={0.7} />
    </span>
  </Frame>
</Section>

<Section {...sec(general, 'requirement-chip')}>
  <div class="pair">
    <Frame label="md · 26" align="center">
      <RequirementChip label="docs.general.requirements.diamond" state="met" />
      <RequirementChip label="docs.general.requirements.hold" state="unmet" />
      <RequirementChip label="docs.general.requirements.verified" state="neutral" icon="user" />
    </Frame>
    <Frame label="sm · 22 · met shorthand" align="center">
      <RequirementChip label="docs.general.requirements.diamond" met size="sm" />
      <RequirementChip label="docs.general.requirements.hold" met={false} size="sm" />
      <RequirementChip label="docs.general.requirements.neutral" size="sm" state="neutral" />
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'countdown')}>
  <Frame cols={200} label="Live · ticks every second under an hour">
    <div class="cd"><span class="label">auto · days</span><span class="cd-val"><Countdown to={inDays} prefix="docs.general.countdown.endsIn" /></span></div>
    <div class="cd"><span class="label">auto · minutes</span><span class="cd-val"><Countdown to={inMinutes} suffix="docs.general.countdown.left" /></span></div>
    <div class="cd"><span class="label">clock</span><span class="cd-val mono-val"><Countdown to={inHours} format="clock" /></span></div>
    <div class="cd"><span class="label">words</span><span class="cd-val"><Countdown to={inHours} format="words" prefix="docs.general.countdown.closesIn" /></span></div>
    <div class="cd"><span class="label">ended</span><span class="cd-val"><Countdown to={ended} ended="docs.general.countdown.votingClosed" /></span></div>
  </Frame>
</Section>

<Section {...sec(general, 'threshold-bar')}>
  <Frame cols="minmax(0, 1fr)">
    <div class="stack gap">
      <div class="tb"><span class="code">Yes 62% · No 14%</span><ThresholdBar yes={0.62} no={0.14} {thresholds} label="docs.general.thresholds.proposalVotes" /></div>
      <div class="tb"><span class="code">Yes 81% · No 6% — past the strong line</span><ThresholdBar yes={0.81} no={0.06} {thresholds} label="docs.general.thresholds.proposalVotes" /></div>
      <div class="tb"><span class="code">Yes 18% · No 47% · 12px</span><ThresholdBar yes={0.18} no={0.47} {thresholds} height={12} label="docs.general.thresholds.proposalVotes" /></div>
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'sortable-input-list')}>
  <div class="pair">
    <Frame cols="minmax(0, 1fr)" label="Try it · drag the handles, type to add">
      <SortableInputList values={sortable} min={2} max={6} itemLabel="docs.general.sortable.answer" label="docs.general.sortable.pollAnswers" onChange={(v) => (sortable = v)} />
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="onChange values">
      <ol class="values">
        {#each sortable as v}<li>{v}</li>{/each}
      </ol>
    </Frame>
  </div>
</Section>

<Section {...sec(general, 'step-indicator')}>
  <Frame cols="minmax(0, 1fr)">
    <div class="row"><span class="code w">current</span><StepIndicator steps={['docs.general.steps.details', 'docs.general.steps.quote', 'docs.general.steps.swap']} current={step} /></div>
    <div class="row"><span class="code w">complete</span><StepIndicator steps={['docs.general.steps.details', 'docs.general.steps.quote', 'docs.general.steps.swap']} current={2} complete /></div>
    <div class="row"><span class="code w">compact</span><StepIndicator steps={['docs.general.steps.details', 'docs.general.steps.quote', 'docs.general.steps.swap']} current={step} compact /></div>
    <div class="row">
      <span class="code w">try it</span>
      <Button label="ui.common.back" variant="ghost" disabled={step === 0} onClick={() => (step = Math.max(0, step - 1))} />
      <Button label="ui.common.next" variant="secondary" disabled={step === 2} onClick={() => (step = Math.min(2, step + 1))} />
    </div>
  </Frame>
</Section>

<Section {...sec(general, 'progress-timeline')}>
  <div class="trio">
    <Frame cols="minmax(0, 1fr)" label="Running">
      <ProgressTimeline {...timelineRunning} />
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="Done">
      <ProgressTimeline {...timelineDone} />
    </Frame>
    <Frame cols="minmax(0, 1fr)" label="Failed · compact, no bar">
      <ProgressTimeline {...timelineFailed} density="compact" showBar={false} />
      <Banner tone="warning" text="docs.general.timeline.fundsSafe" actionLabel="docs.general.timeline.withdraw" actionHandler={() => {}} />
    </Frame>
  </div>
</Section>

<style>
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 16px; }
  .mono { font: 400 11px/1.3 var(--font-mono); color: var(--ink-3); }

  .icons { width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 4px; }
  .icon-cell { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px 10px; border-radius: var(--radius-sm); color: var(--ink); text-align: center; }
  .icon-cell:hover { background: var(--overlay-1); }
  .glyph { width: 20px; height: 20px; background: currentColor; }
  .icon-cell .mono { font-size: 10.5px; overflow-wrap: anywhere; }

  .full { flex-basis: 100%; }
  .span { grid-column: 1 / -1; display: grid; }
  .on-cover { padding: 8px; border-radius: var(--radius-md); background: var(--cover-violet); }

  .states { width: 100%; display: grid; grid-template-columns: 110px repeat(5, minmax(0, 1fr)); align-items: center; gap: 14px 12px; }
  .states .head { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; color: var(--ink-3); }
  .row-label { color: var(--ink-2); }
  .cell { display: flex; }

  .tip-demo { position: relative; display: flex; }
  .hint { font: 500 12.5px/1 var(--font-sans); color: var(--ink-2); text-decoration: underline dotted; text-underline-offset: 3px; cursor: default; }
  .address { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
  .size-label { width: 28px; }
  .copy-field { display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; padding: 10px 10px 10px 14px; padding-inline: 14px 10px; border-radius: var(--radius-md); background: var(--field); box-shadow: inset 0 0 0 1px var(--line-1); }
  .copy-key { flex: none; width: 84px; font: 600 12.5px/1 var(--font-sans); color: var(--ink-3); }
  .tok-row { display: flex; align-items: center; gap: 14px; }
  .tok-row .mono { width: 44px; }
  .picker { width: 100%; max-width: 360px; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 16px; }
  .trio { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; }
  .stack { display: flex; flex-direction: column; min-width: 0; }
  .stack.gap { gap: 14px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; min-width: 0; }
  .grow { flex: 1; min-width: 160px; }
  .code { font: 400 11.5px/1.3 var(--font-mono); color: var(--ink-3); }
  .w { width: 70px; flex: none; }
  .label { font: 500 10px/1 var(--font-mono); letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
  .note { font: 400 12.5px/1.4 var(--font-sans); color: var(--ink-3); }
  .trail { font: 500 12.5px/1 var(--font-mono); color: var(--ink-3); }
  .prose { margin: 0; font: 400 13.5px/1.5 var(--font-sans); color: var(--ink-2); }
  .dialog-body { display: flex; flex-direction: column; gap: 18px; padding: 4px 6px 6px; }
  .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .share-row { display: grid; grid-template-columns: 200px minmax(0, 1fr); align-items: center; gap: 16px; }
  .overlay-bg { display: inline-flex; padding: 10px; border-radius: var(--radius-md); background: var(--cover-violet); }
  .snap-stage { position: relative; height: 260px; border-radius: var(--radius-lg); background: var(--surface-0); box-shadow: inset 0 0 0 1px var(--line-1); overflow: hidden; }
  .float-card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--radius-lg); background: var(--surface-2); box-shadow: var(--shadow-panel), inset 0 0 0 1px var(--line-2); cursor: grab; user-select: none; }
  .float-title { font: 600 13.5px/1 var(--font-sans); color: var(--ink); }
  .burst { position: relative; display: inline-flex; }
  .cd { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: var(--radius-md); background: var(--surface-2); }
  .cd-val { font: 600 15.5px/1.2 var(--font-sans); color: var(--ink); }
  .mono-val { font-family: var(--font-mono); font-weight: 500; }
  .tb { display: flex; flex-direction: column; gap: 8px; }
  .values { margin: 0; padding-inline-start: 20px; font: 400 12.5px/1.8 var(--font-mono); color: var(--ink-2); }
</style>
