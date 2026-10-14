// Section registry: one array per group feeds both the nav links and the <Section> headers.
// Ids are deep-link anchors shared with the prototype's Component Library; keep order and ids stable.
import meta from './meta.json';

export type SectionMeta = { id: string; title: string; meta: string };
export type GroupId = 'foundations' | 'general' | 'features' | 'api';

export const groups: { id: GroupId; label: string; title: string; intro: string }[] = [
  {
    id: 'foundations',
    label: 'Foundations',
    title: 'Foundations',
    intro: 'The raw material every screen is built from: colour, scales, type and the responsive layout ladder. Values are read live from the tokens, so they follow the mode and accent you pick.',
  },
  {
    id: 'general',
    label: 'General',
    title: 'General components',
    intro: 'Product-agnostic components: buttons, inputs, menus, overlays, feedback and the small pieces every screen reuses. None of them know about chats or wallets.',
  },
  {
    id: 'features',
    label: 'Features',
    title: 'Features',
    intro: 'Components that only make sense in OpenChat: chat rows, messages, the composer, navigation, panels, wallet blocks, and the patterns they assemble into.',
  },
  {
    id: 'api',
    label: 'API',
    title: 'API',
    intro: "Every component's props, control type and default, read from the component files themselves. Use it as the contract when wiring a component into the app.",
  },
];

export const foundations: SectionMeta[] = [
  { id: 'colour', title: 'Colour', meta: 'tokens.css · surfaces, ink, lines, accent, status, bubbles' },
  { id: 'scales', title: 'Scales', meta: 'tokens.css · space, radius, size, type, motion, elevation, z' },
  { id: 'typography', title: 'Typography', meta: 'Plus Jakarta Sans · JetBrains Mono' },
  { id: 'layout', title: 'Layout', meta: 'tokens.css · --bp-* · --panel-*' },
];

export const general: SectionMeta[] = [
  { id: 'icons', title: 'Icons', meta: 'icons.js · Icon.dc.html' },
  { id: 'avatars-badges', title: 'Avatars & badges', meta: 'Avatar.dc.html · Badge.dc.html' },
  { id: 'user-chips', title: 'User chips', meta: 'UserChip.dc.html' },
  { id: 'user-cards', title: 'User cards', meta: 'MemberRow.dc.html' },
  { id: 'buttons', title: 'Buttons', meta: 'Button.dc.html · IconButton.dc.html' },
  { id: 'button-states', title: 'Button states', meta: 'Button.dc.html · state' },
  { id: 'inputs-controls', title: 'Inputs & controls', meta: 'Field · TextArea · Toggle · TimedToggle · SegmentedTabs · DurationChips' },
  { id: 'menus', title: 'Menus', meta: 'Menu.dc.html · MenuItem.dc.html' },
  { id: 'context-menu', title: 'Context menu', meta: 'ContextMenu.dc.html · right-click · ⋯ · long-press' },
  { id: 'chat-picker', title: 'Chat picker', meta: 'ChatPicker.dc.html' },
  { id: 'tooltip', title: 'Tooltip', meta: 'Tooltip.dc.html · tooltip.js' },
  { id: 'skeleton', title: 'Skeleton', meta: 'Skeleton.dc.html' },
  { id: 'banners', title: 'Banners', meta: 'Banner.dc.html · UndoToast.dc.html' },
  { id: 'loaders', title: 'Loaders', meta: 'Spinner.dc.html' },
  { id: 'pills', title: 'Pills', meta: 'Pill.dc.html' },
  { id: 'section-labels', title: 'Section labels', meta: 'ListSectionLabel.dc.html' },
  { id: 'copy-button', title: 'Copy button', meta: 'CopyButton.dc.html' },
  { id: 'token-avatars', title: 'Token avatars', meta: 'TokenAvatar.dc.html · TokenPicker.dc.html' },
  { id: 'page-header', title: 'Page header', meta: 'PageHeader.dc.html' },
  { id: 'dialog-shell', title: 'Dialog shell', meta: 'DialogShell.dc.html' },
  { id: 'transaction-rows', title: 'Transaction rows', meta: 'TransactionRow.dc.html' },
  { id: 'detail-rows', title: 'Detail rows', meta: 'DetailRow.dc.html · DetailSection.dc.html' },
  { id: 'share-bars', title: 'Share bars', meta: 'ShareBar.dc.html' },
  { id: 'side-card', title: 'Side card', meta: 'SideCard.dc.html' },
  { id: 'amount-card', title: 'Amount card', meta: 'AmountCard.dc.html' },
  { id: 'quick-amounts', title: 'Quick amounts', meta: 'QuickAmountChips.dc.html' },
  { id: 'avatar-stack', title: 'Avatar stack', meta: 'AvatarStack.dc.html' },
  { id: 'round-icon-button', title: 'Round icon button', meta: 'RoundIconButton.dc.html' },
  { id: 'waveform', title: 'Waveform', meta: 'Waveform.dc.html' },
  { id: 'snap-float', title: 'Snap float', meta: 'SnapFloat.dc.html' },
  { id: 'confetti', title: 'Confetti', meta: 'Confetti.dc.html' },
  { id: 'requirement-chip', title: 'Requirement chip', meta: 'RequirementChip.dc.html' },
  { id: 'countdown', title: 'Countdown', meta: 'Countdown.dc.html' },
  { id: 'threshold-bar', title: 'Threshold bar', meta: 'ThresholdBar.dc.html' },
  { id: 'sortable-input-list', title: 'Sortable input list', meta: 'SortableInputList.dc.html' },
  { id: 'step-indicator', title: 'Step indicator', meta: 'StepIndicator.dc.html' },
  { id: 'progress-timeline', title: 'Progress timeline', meta: 'ProgressTimeline.dc.html' },
];

// ids keep the prototype's app-* anchors so deep links still work
export const features: SectionMeta[] = [
  { id: 'chat-summaries', title: 'Chat summaries', meta: 'ChatRow.dc.html · ActivityRow.dc.html' },
  { id: 'messages', title: 'Messages', meta: 'ChatBubble.dc.html · VoiceMessage.dc.html · TypingIndicator.dc.html' },
  { id: 'rich-messages', title: 'Rich messages', meta: 'MediaMessage · FileMessage · LinkPreview · TransferMessage · SwapOffer · PollMessage · PrizeMessage · ProposalMessage · CallEvent' },
  { id: 'emoji-picker', title: 'Emoji picker', meta: 'EmojiPicker.dc.html' },
  { id: 'message-composer', title: 'Message composer', meta: 'MessageComposer.dc.html · ComposerBar.dc.html' },
  { id: 'navigation', title: 'Navigation', meta: 'NavRail.dc.html' },
  { id: 'panel-blocks', title: 'Panel blocks', meta: 'PanelCover · PanelNavRow · TileButtons · StatCard · StatsDonut' },
  { id: 'empty-error', title: 'Empty & error states', meta: 'EmptyState.dc.html' },
  { id: 'density-overflow', title: 'Density & overflow', meta: 'ChatRow · ChatBubble · MemberRow · worst-case content' },
  { id: 'wallet-blocks', title: 'Wallet blocks', meta: 'BalanceCard.dc.html · TokenCoin.dc.html' },
  { id: 'pattern-list-header', title: 'Pattern · List header', meta: 'ChatListHeader.dc.html' },
  { id: 'pattern-chat-list', title: 'Pattern · Chat list', meta: 'ChatListPanel.dc.html' },
  { id: 'pattern-header', title: 'Pattern · Conversation header', meta: 'ConversationHeader.dc.html' },
  { id: 'pattern-info-panel', title: 'Pattern · Info panel', meta: 'InfoPanel.dc.html · DmPanel.dc.html' },
  { id: 'pattern-group-panel', title: 'Pattern · Group panel', meta: 'GroupPanel.dc.html · GroupStats.dc.html' },
  { id: 'pattern-dividers', title: 'Pattern · Dividers', meta: 'UnreadDivider.dc.html · pinned-to-newest thread' },
  { id: 'pattern-message-group', title: 'Pattern · Message group', meta: 'MessageGroup.dc.html' },
  { id: 'app-call', title: 'Call', meta: 'CallPanel.dc.html · VideoTile.dc.html · MiniCall.dc.html' },
  { id: 'app-daily-puzzle', title: 'Daily puzzle', meta: 'DailyPuzzleCard.dc.html · PuzzleDialog.dc.html' },
  { id: 'app-token-coin', title: 'Token coin', meta: 'TokenCoin.dc.html' },
  { id: 'app-threads', title: 'Threads', meta: 'ThreadList.dc.html · ThreadPanel.dc.html' },
  { id: 'app-dialogs', title: 'Dialogs', meta: 'JoinGateDialog · PollBuilderDialog · PuzzleDialog · MessageActions' },
];

type Meta = { name: string; source: string; props: unknown[] };
export const apiComponents = (meta as Meta[]).filter((m) => m.props.length).sort((a, b) => a.name.localeCompare(b.name));
export const api: SectionMeta[] = apiComponents.map((m) => ({
  id: 'api-' + m.name.toLowerCase(),
  title: m.name,
  meta: `${m.source.split('/').pop()} · ${m.props.length} props`,
}));

export const sectionsFor: Record<GroupId, SectionMeta[]> = { foundations, general, features, api };

/** Section header props by id, for `<Section {...sec(general, 'icons')}>`. */
export const sec = (list: SectionMeta[], id: string): SectionMeta => {
  const s = list.find((x) => x.id === id);
  if (!s) throw new Error('Unknown section ' + id);
  return s;
};
