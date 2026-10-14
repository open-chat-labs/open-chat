// Demo-only data for the docs page (components carry no sample data of their own).
import type { GroupMessage, MenuItem, MessageGroupItem, TokenOption } from '../lib/types';

const icon = (n: string) => `var(--icon-${n}) center/contain no-repeat`;

const chats = [
  { name: 'Lucy Linden', kind: 'Direct chat', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  { name: 'Design Guild', kind: 'Group · 112 members', grad: 'linear-gradient(140deg,#b06bff,#5b2a86)', radius: '11px' },
  { name: 'Matt Rivers', kind: 'Direct chat', grad: 'linear-gradient(140deg,#ffb03d,#ff4d4d)' },
  { name: '#general', kind: 'OpenChat community', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', radius: '11px' },
];

// InviteDialog: everyone you can invite (frequent ones listed before you search) and invites not yet accepted
const invitePeople = [
  { name: 'Emma Kovacs', handle: '@emma_kovacs', color: 'plum' },
  { name: 'Sam Okafor', handle: '@sam_okafor', color: 'blue' },
  { name: 'Robert Lang', handle: '@robert_lang', color: 'slate' },
  { name: 'Alice Anderson', handle: '@alice_anderson', color: 'violet', frequent: true },
  { name: 'Lucy Linden', handle: '@lucy_linden', color: 'teal', frequent: true },
  { name: 'Priya Raman', handle: '@priya_raman', color: 'amber', frequent: true },
  { name: 'Danielle Moreau', handle: '@danielle_m', color: 'blue', frequent: true },
  { name: 'Jonah Weiss', handle: '@jonah_weiss', color: 'violet', frequent: true },
  { name: 'Nadia Rahman', handle: '@nadia_r', color: 'teal' },
  { name: 'Otto Lindqvist', handle: '@otto_l', color: 'blue' },
  { name: 'Marcus Webb', handle: '@marcus_webb', color: 'amber' },
  { name: 'Sofia Castellanos', handle: '@sofia_c', color: 'violet' },
  { name: 'Ravi Menon', handle: '@ravi_menon', color: 'teal' },
];
const invitePending = [
  { title: 'Tom Beckett', handle: '@tom_beckett', color: 'blue' },
  { title: 'Ines Duarte', handle: '@ines_duarte', color: 'plum' },
  { title: 'Karl Osei', handle: '@karl_osei', color: 'slate' },
];

const menuItems = [
  { label: 'docs.features.menu.addFavourites', mask: icon('heart') },
  { label: 'docs.features.menu.muteNotifications', mask: icon('bell-off') },
  { label: 'docs.features.menu.markRead', mask: icon('check') },
  { label: 'docs.features.menu.leaveGroup', variant: 'danger', mask: icon('leave') },
];

const walletTokens = [
  { symbol: 'ICP', name: 'Internet Computer', mark: '\u221E', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', held: 4820, price: 5.48, dp: 4, fee: 0.0001, payable: true, nets: ['icp'] },
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', held: 132.33, price: 0.053, dp: 4, fee: 0.001, payable: true, nets: ['icp'] },
  { symbol: 'BTC', name: 'Bitcoin', mark: '\u20BF', grad: 'linear-gradient(140deg,#F7A63B,#F7931A)', held: 0.0213, price: 62000, dp: 8, fee: 0.0000001, payable: true, nets: ['btc', 'icp'] },
  { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'linear-gradient(140deg,#4BD6A8,#1E9E7E)', held: 250, price: 1, dp: 2, fee: 0.01, nets: ['eth', 'icp'] },
];

// Opened from a button in the docs. Every *Dialog is treated as an overlay too.
export const overlays = ['DialogShell', 'ChatPicker', 'MessageActions'];

// Group / chat fixtures the panels used to carry inline (GroupPanel, GroupStats, ChatListPanel, ActivityPanel, ThreadPanel, UserDialog).
const groupStats = {
  mix: [
    { label: 'docs.features.groupStats.text', count: 1286 },
    { label: 'docs.features.groupStats.images', count: 56 },
    { label: 'docs.features.groupStats.files', count: 25 },
    { label: 'docs.features.groupStats.gifs', count: 21 },
    { label: 'docs.features.groupStats.pollsVideoAudio', count: 29 },
  ],
  weeks: [186, 241, 198, 274, 312, 268, 355, 298, 389, 341, 402, 447],
  people: [
    { name: 'Priya Raman', count: 312, gradient: 'linear-gradient(145deg,#8FE3C6,#3FB99A)' },
    { name: 'Danielle Moreau', count: 268, gradient: 'linear-gradient(145deg,#C9B4FF,#8A6BE0)' },
    { name: 'Jonah Weiss', count: 191, gradient: 'linear-gradient(145deg,#FFD79A,#E8A13C)' },
  ],
  engagement: [
    { count: '462', label: 'docs.features.groupStats.reactions' },
    { count: '75', label: 'docs.features.groupStats.replies' },
    { count: '11', label: 'docs.features.groupStats.pollVotes' },
    { count: '5', label: 'docs.features.groupStats.deleted' },
  ],
  totalPrev: 1298,
  otherPeople: 37,
  onlineMinutes: 1659,
  onlineMinutesPrev: 1521,
};

const groupPanel = {
  ownerHandle: '@jane_smith',
  members: [
    { title: 'Jane Smith', handle: '@jane_smith', tag: 'OWNER', color: 'violet' },
    { title: 'John Smith', handle: '@john_smith', tag: 'YOU', color: 'blue' },
    { title: 'Alice Anderson', handle: '@alice_anderson', tag: 'ADMIN', color: 'rose' },
    { title: 'Lucy Linden', handle: '@lucy_linden', tag: 'ADMIN', color: 'teal' },
    { title: 'Ryan Rogers', handle: '@ryan_rogers', tag: '', color: 'amber' },
    { title: 'Christina Cameron', handle: '@christina_cameron', tag: '', color: 'plum' },
    { title: 'Marcus Webb', handle: '@marcus_webb', tag: '', color: 'slate' },
    { title: 'Priya Raman', handle: '@priya_raman', tag: '', color: 'teal' },
  ],
  lapsed: [
    { title: 'Tom Hayes', handle: '@tom_hayes', tag: 'LAPSED', color: 'amber' },
    { title: 'Nadia Rahman', handle: '@nadia_r', tag: 'LAPSED', color: 'teal' },
    { title: 'Otto Lindqvist', handle: '@otto_l', tag: 'LAPSED', color: 'violet' },
  ],
  blocked: [
    { title: 'Vic Palmer', handle: '@vic_palmer', tag: 'BLOCKED', color: 'blue' },
    { title: 'Rex Duvall', handle: '@rex_duvall', tag: 'BLOCKED', color: 'amber' },
  ],
  bots: [
    { variant: 'bot', title: 'LlamaBot', subtitle: 'Sends prompts to the Llama 3 LLM and posts the reply in the thread.', color: 'slate' },
    { variant: 'bot', title: 'WelcomeBot', subtitle: 'Greets new members with a custom message when they join.', color: 'plum' },
  ],
  webhooks: [
    { variant: 'webhook', title: 'ci_builds', subtitle: '', color: 'blue', url: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/155810f3b90cb851aa633fc4aa435482' },
    { variant: 'webhook', title: 'monitoring_alerts', subtitle: '', color: 'plum', url: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/8d2c47ae91b05f7361ce0b4482da19f7' },
  ],
  recommendedBots: [
    { variant: 'bot', title: 'ReminderBot', subtitle: 'Sends one-off and recurring reminder messages.', color: 'slate' },
    { variant: 'bot', title: 'YoutubeBot', subtitle: 'Subscribe to a YouTube channel to get updates about new video releases.', color: 'rose' },
    { variant: 'bot', title: 'DiscordBot', subtitle: 'Proxy messages from your Discord community into OpenChat.', color: 'blue' },
    { variant: 'bot', title: 'AdventureBot', subtitle: 'Play a selection of classic text-based adventures in chat.', color: 'amber' },
    { variant: 'bot', title: 'ModerationBot', subtitle: 'Performs automated moderation using rules you configure.', color: 'teal' },
  ],
  userGroups: [
    { key: 'ug0', title: 'Developers', color: 'blue', members: [] },
    { key: 'ug1', title: 'Designers', color: 'plum', members: [] },
  ],
  gateState: {
    rules: [
      { id: 'g1', type: 'lifetime' },
      { id: 'g2', type: 'unique' },
      { id: 'g3', type: 'balance', asset: 'CHAT', a: '100' },
      { id: 'g4', type: 'neuron', asset: 'OpenChat', a: '90' },
    ],
    joiner: 'All',
    intervalOn: true,
    every: '90 days',
  },
  rules: {
    enabled: true,
    text: ['Do not impersonate others in a deceptive or misleading manner.', 'Do not intentionally share false or misleading information.', 'Keep messages relevant to the group.']
      .map((r) => '• ' + r)
      .join('\n'),
  },
  stats: groupStats,
};

const activityItems = [
  { day: 'Today', title: 'Bob and two others reacted to your message', context: 'The Awesome Group', preview: 'You / The illustration slot is in — take a look at the spacing on mobile', time: '44 min', unread: true, color: 'teal', kind: 'group', reactions: ['😎', '👍', '🙏', '+2'], type: 'reaction', chat: 'The Awesome Group' },
  { day: 'Today', title: 'Marcus mentioned you', context: 'Design Guild', preview: 'Marcus / @you can we get the audit numbers into the deck?', time: '2 h', unread: true, color: 'violet', kind: 'group', type: 'mention', chat: 'Design Guild' },
  { day: 'Yesterday', title: 'Danielle quote replied', context: 'Private chat', preview: "Danielle / Agreed — let's ship the shorter version", time: '1 d', unread: false, color: 'blue', kind: 'user', type: 'reply', chat: 'Danielle Moreau' },
  { day: 'Monday', title: 'Priya sent 150 CHAT', context: 'Release Train', preview: 'Priya / for the release notes, thanks again', time: '3 d', unread: false, color: 'teal', kind: 'group', type: 'payment', chat: 'Release Train' },
  { day: 'Monday', title: 'Robert reacted to your message', context: 'Private chat', preview: 'You / Okay mate, that sounds good', time: '3 d', unread: false, color: 'amber', kind: 'user', reactions: ['😎', '👍'], type: 'reaction', chat: 'Robert Kim' },
  { day: 'Friday 14th Nov 2025', title: 'Marcus sent 10 USDT', context: 'Private chat', preview: 'Marcus / covering the audit tooling', time: '1 w', unread: false, color: 'blue', kind: 'user', type: 'payment', chat: 'Marcus Webb' },
];

const chatListRows = [
  { title: 'Danielle Moreau', section: 'Pinned', preview: 'Pushed the updated flow', time: '10:42', unreadCount: 3, color: 'violet', online: true, verified: false, selected: true },
  { title: 'The Awesome Group', kind: 'group', section: 'Pinned', preview: 'Priya: see you at 4', time: '09:18', unreadCount: 0, color: 'teal', online: true, verified: true, selected: false },
  { title: 'Marcus Webb', preview: 'Okay mate, that sounds good', time: 'Yest', unreadCount: 0, color: 'amber', online: false, verified: false, selected: false },
];

// CreateGroupDialog's built-in demo people from the export
const createGroupPeople = [
  { name: 'Alice Anderson', handle: '@alice_anderson', color: 'violet' },
  { name: 'Lucy Linden', handle: '@lucy_linden', color: 'teal' },
  { name: 'Priya Raman', handle: '@priya_raman', color: 'amber' },
  { name: 'Danielle Moreau', handle: '@danielle_m', color: 'blue' },
  { name: 'Jonah Weiss', handle: '@jonah_weiss', color: 'violet' },
  { name: 'Robert Rodriguez', handle: '@robert_r', color: 'amber' },
  { name: 'Nadia Rahman', handle: '@nadia_r', color: 'teal' },
  { name: 'Otto Lindqvist', handle: '@otto_l', color: 'blue' },
];

// Explore: a spread of sizes, languages and activity so every sort and the language filter have something to do.
const exploreCommunities = [
  { key: 'oc', name: 'OpenChat', about: 'The official OpenChat community: product news, feedback and support.', members: 48210, active: 98, created: 1, verified: true, pin: 'rose', channels: [{ title: 'general' }, { title: 'announcements' }, { title: 'feedback' }] },
  { key: 'icp', name: 'Internet Computer', about: 'Developers and enthusiasts building on the Internet Computer.', members: 31544, active: 91, created: 2, verified: true, pin: 'violet', channels: [{ title: 'general' }, { title: 'dev' }] },
  { key: 'design', name: 'Design Guild', about: 'Critique, tools and inspiration for product designers.', members: 6120, active: 74, created: 7, pin: 'plum', cover: 'violet', channels: [{ title: 'crit' }, { title: 'jobs' }] },
  { key: 'dragon', name: 'Dragon Paladins', about: 'Weekly raids, guild events and loot talk.', members: 12890, active: 86, created: 5, pin: 'sunset', channels: [{ title: 'raids' }, { title: 'trading' }, { title: 'officers', visibility: 'Private' as const }] },
  { key: 'cafe', name: 'Café Crypto', about: 'Discussions sur les cryptomonnaies, en français.', members: 3405, active: 52, created: 9, language: 'French', pin: 'amber', channels: [{ title: 'général' }] },
  { key: 'tokyo', name: '東京 Builders', about: '東京のWeb3ビルダーのためのコミュニティ。', members: 2210, active: 61, created: 11, language: 'Japanese', pin: 'teal', channels: [{ title: 'general' }] },
  { key: 'photo', name: 'Analog Photography', about: 'Film stocks, darkroom tips and weekly photo threads.', members: 1876, active: 40, created: 12, pin: 'blue', channels: [{ title: 'gallery' }, { title: 'gear' }] },
  { key: 'es', name: 'Comunidad ICP', about: 'La comunidad hispanohablante del Internet Computer.', members: 4502, active: 58, created: 8, language: 'Spanish', pin: 'teal', verified: true, channels: [{ title: 'general' }] },
];

export const samples: Record<string, Record<string, unknown>> = {
  CreateGroupDialog: { people: createGroupPeople, invitePeople: createGroupPeople, preselected: ['@alice_anderson', '@lucy_linden'] },
  GroupPanel: groupPanel,
  GroupStats: groupStats,
  ActivityPanel: { items: activityItems },
  ChatListPanel: { rows: chatListRows },
  ThreadPanel: { root: { author: 'Ana Ferreira', color: 'violet', text: "Agreed. Let's decide on the scale before anyone touches a component.", time: '11:15' } },
  ThreadList: { groups: [] },
  UserDialog: {
    facts: [
      { label: 'docs.features.userFacts.memberSince', value: '1 Nov 2021' },
      { label: 'docs.features.userFacts.chitEarned', value: '339,400', highlight: true },
      { label: 'docs.features.userFacts.status', value: 'docs.features.userFacts.onlineNow', dot: true },
    ],
  },
  Menu: { items: menuItems },
  StepIndicator: { steps: ['Details', 'Quote', 'Swap'] },
  WalletMain: { tokens: walletTokens, handle: '@you' },
  WalletPanel: { tokens: walletTokens },
  WalletReceive: { tokens: walletTokens },
  WalletSend: { tokens: walletTokens },
  WalletSwap: { tokens: walletTokens },
  WalletRecipients: {
    tokens: walletTokens,
    recipients: [
      { id: 'r1', name: 'Ada — rent', address: '5sj6i-pqaaa-aaaaf-a3cmq-cai', token: 'CHAT', last: 'Sent 3 days ago' },
      { id: 'r2', name: 'Mum', address: 'rdmx6-jaaaa-aaaaa-aaadq-cai', token: 'ICP', last: 'Sent last week' },
      { id: 'r3', name: 'Hot wallet', address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', token: null, last: 'Sent 2 months ago' },
      { id: 'r4', name: 'Ledger cold', address: 'bc1q9h7garjqr0fy4ypz8w3c2y0w8qk3n6vqx4m2lc', token: null, last: 'Never sent' },
      { id: 'r5', name: 'Kraken deposit', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', token: null, last: 'Sent yesterday' },
    ],
  },
  DiamondDialog: { tokens: walletTokens },
  BotDialog: { bot: { name: 'ReminderBot' } },
  InviteDialog: { people: invitePeople, pending: invitePending, chats: chats.slice(0, 3) },
  ExploreCommunities: { communities: exploreCommunities, joinedKeys: ['oc'] },
  WalletSettingsDialog: { tokens: ['ICP', 'CHAT', 'BTC', 'USDT'] },
  ChatRow: { menuItems },
  ChatPicker: { item: { title: 'Invite link', sub: 'oc.app/group/the-awesome-group-8f2a', icon: 'link' }, chats },
  ProgressTimeline: {
    density: 'compact',
    phases: [
      { title: 'Send to ICPSwap', steps: [{ label: 'Get deposit account', state: 'done' }, { label: 'Transfer 100 CHAT to ICPSwap', state: 'done' }, { label: 'Notify ICPSwap of the deposit', state: 'active' }] },
      { title: 'Swap', steps: [{ label: 'Swap CHAT for ICP', state: 'todo' }] },
      { title: 'Return to your wallet', steps: [{ label: 'Withdraw 2.19425 ICP from ICPSwap', state: 'todo' }] },
    ],
  },
  MessageGroup: {
    messages: [
      { text: 'The illustration slot is in — take a look', time: '10:41' },
      { text: 'Happy to iterate on the colours', time: '10:42' },
    ],
  },
  AvatarStack: { people: ['linear-gradient(140deg,#FFB86B,#FF5672)', 'linear-gradient(140deg,#7FD1FF,#5C7CFF)', 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', 'linear-gradient(140deg,#B48CFF,#6A5CFF)', 'linear-gradient(140deg,#FFC061,#FF8A3D)'] },
  SortableInputList: { values: ['Pizza', 'Tacos', 'Sushi'] },
  Countdown: { to: Date.now() + 3 * 3600e3 + 12 * 60e3 },
  MiniCall: { start: Date.now() - 754000 },
  WebhookDialog: { urlPrefix: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/' },
  PrizeBuilderDialog: {
    tokens: [
      { symbol: 'CHAT', mark: 'C', gradient: 'linear-gradient(140deg,#ff5f9e,#ffb03d)', bal: 132.332136, fee: 0.001, minPer: 0.1, dp: 4 },
      { symbol: 'ICP', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', bal: 4.2153, fee: 0.0001, minPer: 0.01, dp: 4 },
      { symbol: 'ckBTC', mark: '₿', gradient: 'linear-gradient(140deg,#ffb03d,#f7931a)', bal: 0.00213, fee: 0.0000001, minPer: 0.000001, dp: 8 },
      { symbol: 'ckUSDC', mark: '$', gradient: 'linear-gradient(140deg,#2775ca,#1FB6FF)', bal: 48.5, fee: 0.01, minPer: 0.1, dp: 2 },
    ],
  },
  MemeFighterDialog: {
    // placeholder art: gradient "panels", text boxes in % of the image
    templates: [
      { id: 'distracted', name: 'Distracted', vibes: ['lol'], ar: 1.5, cols: 1, cells: ['linear-gradient(150deg,#d8b48a,#5b7a96)'], boxes: [[12, 60, 34, 22], [46, 40, 26, 18], [73, 46, 25, 28]] },
      { id: 'approve', name: 'Nope / Yep', vibes: ['happy', 'lol'], ar: 1, cols: 2, cells: ['linear-gradient(150deg,#f2b45a,#c2562f)', '#f4f1ea', 'linear-gradient(150deg,#f2b45a,#7a3a1f)', '#f4f1ea'], boxes: [[52, 4, 46, 42], [52, 54, 46, 42]] },
      { id: 'panik', name: 'Panik, kalm, panik', vibes: ['anxiety'], ar: 0.9, cols: 2, cells: ['#f4f1ea', 'linear-gradient(150deg,#e8c3a0,#a87454)', '#f4f1ea', 'linear-gradient(150deg,#e8c3a0,#a87454)', '#f4f1ea', 'linear-gradient(150deg,#e8c3a0,#7d4a2f)'], boxes: [[3, 3, 44, 28], [3, 36, 44, 28], [3, 69, 44, 28]] },
      { id: 'buttons', name: 'Two buttons', vibes: ['anxiety'], ar: 0.8, cols: 1, cells: ['linear-gradient(180deg,#e04646,#f3d36b)'], boxes: [[10, 8, 36, 16], [54, 4, 36, 16], [10, 72, 80, 22]] },
      { id: 'brain', name: 'Expanding brain', vibes: ['fresh', 'lol'], ar: 0.8, cols: 2, cells: ['#f4f1ea', 'linear-gradient(150deg,#6aa7ff,#1b2a6b)', '#f4f1ea', 'linear-gradient(150deg,#8cc8ff,#2b4ab5)', '#f4f1ea', 'linear-gradient(150deg,#b5e0ff,#4a6fd6)', '#f4f1ea', 'linear-gradient(150deg,#ffffff,#7fb2ff)'], boxes: [[3, 2, 45, 21], [3, 27, 45, 21], [3, 52, 45, 21], [3, 77, 45, 21]] },
      { id: 'butterfly', name: 'Is this a…?', vibes: ['fresh'], ar: 1.2, cols: 1, cells: ['linear-gradient(150deg,#86a8c8,#e3c9a0)'], boxes: [[56, 4, 40, 18], [4, 66, 44, 20], [52, 80, 44, 16]] },
      { id: 'mind', name: 'Change my mind', vibes: ['angry'], ar: 1.4, cols: 1, cells: ['linear-gradient(150deg,#9bbf7a,#3d5a2f)'], boxes: [[40, 52, 52, 30]] },
      { id: 'fine', name: 'This is fine', vibes: ['anxiety', 'angry'], ar: 1.6, cols: 1, cells: ['linear-gradient(150deg,#ff9a3d,#8a2b14)'], boxes: [[6, 4, 88, 20], [6, 76, 88, 20]] },
    ],
  },
  AuthDialog: {
    referrers: [
      { name: 'Hamish', handle: 'hamish', grad: 'linear-gradient(140deg,#8B7BFF,#5B3FD9)' },
      { name: 'Ana Ribeiro', handle: 'ana_r', grad: 'linear-gradient(140deg,#5CB8FF,#2F6BFF)' },
      { name: 'Julian', handle: 'julian_jelfs', grad: 'linear-gradient(140deg,#2EE6A8,#1FA6B8)' },
      { name: 'Matt Grogan', handle: 'matt', grad: 'linear-gradient(140deg,#FFC061,#F58A2E)' },
      { name: 'Hannah', handle: 'hannah_k', grad: 'linear-gradient(140deg,#FF8FA8,#E0456A)' },
    ],
    checkUsername: (name: string) => !['openchat', 'hamish', 'admin', 'julian_jelfs', 'matt'].includes(name),
  },
  NavRail: {
    items: [{ icon: 'messages', label: 'docs.features.navRail.chats', dot: true, count: 3 }, { icon: 'bell', label: 'ui.navRail.notifications' }, { icon: 'wallet', label: 'ui.navRail.wallet' }],
    pins: [{ color: 'sunset', name: 'Community 01' }, { color: 'blue', name: 'Community 02' }, { color: 'teal', name: 'Community 03', dot: true }, { color: 'plum', name: 'Community 04' }],
  },
  CallPanel: { people: [{ name: 'julian_jelfs', initial: 'J', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)' }] },
  LeaderboardDialog: {
    initialPeriod: 'september',
    boards: {
      august: {
        label: 'docs.features.leaderboard.august',
        rows: [['SKYE_TERRIER', 64200], ['AKMANNURIYE', 61500], ['KEYTAATGLU', 52800], ['ZARINAZARI', 44100], ['KAY', 38900], ['HAFSAT001', 33200], ['0XCLD', 31800], ['VA867', 29400], ['PIKO_NETWORK', 25600], ['BRITTANY91', 24900]],
        you: { rank: 312, score: 17800 },
      },
      september: {
        label: 'docs.features.leaderboard.september',
        rows: [['AKMANNURIYE', 70800], ['SKYE_TERRIER', 70800], ['ZARINAZARI', 70600], ['KEYTAATGLU', 38400], ['HAFSAT001', 37000], ['KAY', 36800], ['VA867', 36000], ['0XCLD', 34600], ['BRITTANY91', 31500], ['PIKO_NETWORK', 27700]],
        you: { rank: 245, score: 21400 },
      },
      all: {
        label: 'docs.features.leaderboard.allTime',
        rows: [['AKMANNURIYE', 3853800], ['SKYE_TERRIER', 3577200], ['KEYTAATGLU', 2894400], ['ZARINAZARI', 2706900], ['KAY', 2344500], ['0XCLD', 2117700], ['HAFSAT001', 2064600], ['VA867', 1838100], ['BRITTANY91', 1678200], ['PIKO_NETWORK', 1494300]],
        you: { rank: 188, score: 539400 },
      },
    },
  },
  MessageActions: { open: true, point: { x: 240, y: 240 } },
  // copy props whose meta.json demo value is English: pass keys so the docs language switch reaches them
  UpgradeBanner: { text: 'docs.features.upgradeBanner.publicGroups', actionLabel: 'ui.upgradeBanner.upgrade' },
  LeaveGroupDialog: { body: 'ui.leaveGroupDialog.body' },
  PanelCover: { actions: ['close'], trailActions: ['favourite'] },
  TileButtons: { tiles: ['video', 'mute', 'search'] },
  TypingIndicator: { names: ['Danielle', 'Priya'], colors: ['violet', 'teal'] },
  ComposerBar: { typingNames: ['Danielle', 'Priya'] },
  StatsDonut: {
    slices: [
      { type: 'text', label: 'ui.statsDonut.types.text', count: 1286 },
      { type: 'image', label: 'ui.statsDonut.types.image', count: 56 },
      { type: 'video', label: 'ui.statsDonut.types.video', count: 11 },
      { type: 'audio', label: 'ui.statsDonut.types.audio', count: 3 },
      { type: 'file', label: 'ui.statsDonut.types.file', count: 25 },
      { type: 'poll', label: 'ui.statsDonut.types.poll', count: 12 },
      { type: 'crypto', label: 'ui.statsDonut.types.crypto', count: 3 },
      { type: 'gif', label: 'ui.statsDonut.types.gif', count: 21 },
    ],
    extras: [
      { label: 'docs.features.statsDonut.pollVotes', count: '11' },
      { label: 'docs.features.statsDonut.replies', count: '75' },
      { label: 'docs.features.statsDonut.reactions', count: '462' },
      { label: 'docs.features.statsDonut.deleted', count: '5' },
    ],
  },
  // the export rendered an empty community with no gates by default
  JoinGateDialog: { community: { name: '' }, gates: [] },
  ImportToCommunityDialog: {
    communities: [
      { name: 'Community One', members: 1234, channels: 10 },
      { name: 'Community Two', members: 1234, channels: 10 },
    ],
  },
  PollMessage: { options: [{ label: 'Tuesday evening', votes: 12 }, { label: 'Wednesday lunch', votes: 31 }, { label: 'Thursday evening', votes: 7 }] },
  SegmentedTabs: { labels: ['All', 'Direct', 'Groups', 'Unread'] },
  PrizeMessage: { token: { symbol: 'ICP', mark: '\u221E', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', edge: '#7a2f8f', edge2: '#5c2370' } },
  SwapOffer: {
    give: { amount: '20', symbol: 'ICP', mark: '\u221E', usd: '$1,095.87', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' },
    get: { amount: '100', symbol: 'CHAT', mark: 'C', usd: '$1,113.35', gradient: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  },
  // the export's built-in demo data, now passed in
  ProfileDialog: {
    chitEarned: 539400,
    achievementsLeft: 12,
    onlineMinutes: 2942,
    onlineMinutesPrev: 3965,
    reported: 5,
    storageUsedMB: 83.4,
    version: '2.0.2054',
    messageMix: [
      { label: 'Text', count: 1286 },
      { label: 'Images', count: 56 },
      { label: 'Files', count: 25 },
      { label: 'GIFs', count: 21 },
      { label: 'Polls, video, audio & crypto', count: 34 },
    ],
    engagement: [
      { count: '462', label: 'Reactions' },
      { count: '75', label: 'Replies' },
      { count: '11', label: 'Poll votes' },
      { count: '5', label: 'Deleted' },
    ],
    communities: [
      { name: 'OpenChat Devs', color: 'teal' },
      { name: 'Design Guild', color: 'violet' },
      { name: 'Pixel Art Club', color: 'amber' },
      { name: 'ICP Builders', color: 'blue' },
      { name: 'Crypto Chat', color: 'plum' },
      { name: 'Night Owls', color: 'rose' },
      { name: 'Weekend Runners', color: 'slate' },
    ],
    communityNames: { 'Design Guild': 'James · Product', 'ICP Builders': 'jsmith.icp', 'Night Owls': 'Jimmy' },
    signinMethods: [
      { type: 'passkey', id: 'l45dg-bz7s…-ob25p-cae', title: 'Passkey in 1Password', short: '1Password passkey', used: 'In use now', current: true },
      { type: 'passkey', id: 'vpzuo-ist3…-aal7i-rqe', title: 'Passkey in 1Password', used: 'Last used 3 weeks ago' },
      { type: 'passkey', id: 'c5qvb-shzm…-3ye3o-7qe', title: 'Passkey in NordPass', used: 'Last used in March' },
      { type: 'ii', id: '62mzz-hssh…-xvcvl-rqe', title: 'Internet Identity', used: 'Last used 2 days ago' },
      { type: 'email', id: 'james.smith@proton.me', title: 'james.smith@proton.me', used: 'Last used in June' },
    ],
  },
};

// ─── General · icons … token avatars ─────────────────────────────────────────────────────────────────

// Demo data for the General group, sections icons … token-avatars (merged into samples.ts later).


export const contextMenuItems: MenuItem[] = [
  { label: 'docs.general.samples.menu.addToFavourites', mask: icon('heart') },
  { label: 'docs.general.samples.menu.muteNotifications', mask: icon('bell-off') },
  { label: 'docs.general.samples.menu.markAsRead', mask: icon('check') },
  { label: 'docs.general.samples.menu.leaveGroup', variant: 'danger', mask: icon('leave') },
];

export const menuDemo: MenuItem[] = [
  { label: 'ui.common.reply', icon: 'reply', shortcut: 'R' },
  { label: 'docs.general.samples.menu.forward', icon: 'forward' },
  { label: 'docs.general.samples.menu.copyText', icon: 'copy', shortcut: '⌘C' },
  { label: 'ui.common.delete', variant: 'danger', icon: 'trash' },
];

export const sortMenu: MenuItem[] = [
  { label: 'docs.general.samples.sort.newestFirst', checkMask: icon('check') },
  { label: 'docs.general.samples.sort.oldestFirst' },
  { label: 'docs.general.samples.sort.mostMembers' },
];

export const contextRows = [
  { title: 'Design Guild', preview: 'Ana: Agreed — scale first, then components.', time: '11:15', kind: 'group', color: 'violet', unreadCount: 4 },
  { title: 'Lucy Linden', preview: 'See you at the meetup!', time: '10:02', kind: 'user', color: 'teal', online: true, verified: true },
  { title: 'announcements', preview: 'v3 ships next week 🎉', time: 'Tue', kind: 'channel', color: 'amber', unreadCount: 12, muted: true },
] as const;

export const pickerTokens: TokenOption[] = [
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', held: '4,820' },
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', gradient: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', held: '132.33' },
  { symbol: 'BTC', name: 'Bitcoin', mark: '₿', gradient: 'linear-gradient(140deg,#F7A63B,#F7931A)', held: '0.0213' },
  { symbol: 'USDT', name: 'Tether', mark: 'T', gradient: 'linear-gradient(140deg,#4BD6A8,#1E9E7E)' },
  { symbol: 'ETH', name: 'Ethereum', mark: 'Ξ', gradient: 'linear-gradient(140deg,#8C9EFF,#5C6BC0)' },
  { symbol: 'GHOST', note: 'Not supported for swaps yet', mark: 'G', gradient: 'linear-gradient(140deg,#B48CFF,#6A5CFF)' },
];

// ─── General · page header … progress timeline ───────────────────────────────────────────────────────

// Demo data for the General group, page-header … progress-timeline (merged into samples.ts later).

export const tokenIcp = { symbol: 'ICP', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' };
export const tokenChat = { symbol: 'CHAT', mark: 'C', gradient: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' };
export const tokenBtc = { symbol: 'BTC', mark: '₿', gradient: 'linear-gradient(140deg,#F7A63B,#F7931A)' };

export const transactions = [
  { title: 'Received from Lucy Linden', sub: '10:42 · in The Awesome Group', amount: '+385.60 ICP', fiat: '$2,113.47', kind: 'receive' as const, ...tokenIcp, fresh: true },
  { title: 'Sent to Matt Rivers', sub: 'Yesterday · direct chat', amount: '−12.00 CHAT', fiat: '$0.64', kind: 'send' as const, ...tokenChat },
  { title: 'Swapped CHAT → ICP', sub: 'Mon · ICPSwap', amount: '+2.19 ICP', fiat: '$12.02', kind: 'swap' as const, ...tokenIcp, status: 'docs.general.samples.status.pending', statusTone: 'warning' as const },
  { title: 'Sent to bc1qar0…5mdq', sub: '12 Oct · Bitcoin network', amount: '−0.0012 BTC', fiat: '$74.40', kind: 'send' as const, ...tokenBtc, status: 'docs.general.samples.status.failed', statusTone: 'danger' as const },
];

// people as CSS backgrounds built from theme tokens, so the stack follows mode and accent
export const stackPeople = [
  { grad: 'linear-gradient(140deg, var(--accent-bright), var(--accent))', name: 'Lucy Linden', initial: 'L' },
  { grad: 'linear-gradient(140deg, var(--category-a), var(--status-verified))', name: 'Matt Rivers', initial: 'M' },
  { grad: 'linear-gradient(140deg, var(--category-b), var(--category-a))', name: 'Ana Ferreira', initial: 'A' },
  { grad: 'linear-gradient(140deg, var(--category-c), var(--status-chit))', name: 'Priya Raman', initial: 'P' },
  { grad: 'linear-gradient(140deg, var(--status-online), var(--category-b))', name: 'Sam Okafor', initial: 'S' },
  { grad: 'linear-gradient(140deg, var(--status-warning), var(--accent))', name: 'Nadia Rahman', initial: 'N' },
  { grad: 'linear-gradient(140deg, var(--category-a), var(--accent))', name: 'Otto Lindqvist', initial: 'O' },
];

export const thresholds = [
  { at: 0.5, label: 'docs.general.samples.thresholds.majorityAdoptedWhenVotingEnds' },
  { at: 0.75, label: 'docs.general.samples.thresholds.adoptedImmediately', strong: true },
];

export const timelineRunning = [
  { title: 'docs.general.samples.timeline.sendToIcpswap', steps: [{ label: 'docs.general.samples.timeline.getDepositAccount', state: 'done' as const }, { label: 'Transfer 100 CHAT to ICPSwap', state: 'done' as const }, { label: 'docs.general.samples.timeline.notifyIcpswapOfTheDeposit', state: 'active' as const }] },
  { title: 'docs.general.samples.timeline.swap', steps: [{ label: 'docs.general.samples.timeline.swapChatForIcp', state: 'todo' as const }] },
  { title: 'docs.general.samples.timeline.returnToYourWallet', steps: [{ label: 'Withdraw 2.19425 ICP from ICPSwap', state: 'todo' as const }] },
];

export const timelineDone = [
  { title: 'docs.general.samples.timeline.sendToIcpswap', steps: [{ label: 'docs.general.samples.timeline.getDepositAccount', state: 'done' as const }, { label: 'Transfer 100 CHAT to ICPSwap', state: 'done' as const }, { label: 'docs.general.samples.timeline.notifyIcpswapOfTheDeposit', state: 'done' as const }] },
  { title: 'docs.general.samples.timeline.swap', steps: [{ label: 'docs.general.samples.timeline.swapChatForIcp', state: 'done' as const }] },
  { title: 'docs.general.samples.timeline.returnToYourWallet', steps: [{ label: 'Withdraw 2.19425 ICP from ICPSwap', state: 'done' as const }] },
];

export const timelineFailed = [
  { title: 'docs.general.samples.timeline.sendToIcpswap', steps: [{ label: 'docs.general.samples.timeline.getDepositAccount', state: 'done' as const }, { label: 'Transfer 100 CHAT to ICPSwap', state: 'done' as const }, { label: 'docs.general.samples.timeline.notifyIcpswapOfTheDeposit', state: 'done' as const }] },
  {
    title: 'docs.general.samples.timeline.swap',
    error: 'ICPSwap rejected the swap: price moved past your slippage limit.',
    steps: [{ label: 'docs.general.samples.timeline.swapChatForIcp', state: 'failed' as const }],
  },
  { title: 'docs.general.samples.timeline.returnToYourWallet', steps: [{ label: 'Withdraw 100 CHAT from ICPSwap', state: 'todo' as const }] },
];

export const sortableStart = ['Pizza', 'Tacos', 'Sushi'];

// ─── App · chat summaries … wallet blocks ────────────────────────────────────────────────────────────

// Demo data for the App group's first sections (chat summaries … wallet blocks). Colours come from tokens
// (var(--cover-*)) or reuse the gradients already in samples.ts, so nothing new is hard-coded here.

const people = samples.AvatarStack.people as string[];
const swap = samples.SwapOffer as { give: { gradient: string; mark: string }; get: { gradient: string; mark: string } };
const tokens = samples.WalletMain.tokens as { symbol: string; mark: string; grad: string; held: number; price: number }[];

export const chatRowMenu = samples.ChatRow.menuItems as MenuItem[];

export const reactions = [
  { emoji: '👍', count: 4, mine: true },
  { emoji: '🔥', count: 2 },
  { emoji: '😂', count: 1 },
];

export const album = [
  { bg: 'var(--cover-teal)', w: 4, h: 3 },
  { bg: 'var(--cover-violet)', w: 3, h: 4 },
  { bg: 'var(--cover-amber)', w: 1, h: 1 },
  { bg: 'var(--cover-plum)', w: 4, h: 3 },
];
export const wide = [{ bg: 'var(--cover-violet)', w: 16, h: 9 }];
export const upload = [{ bg: 'var(--cover-slate)', w: 4, h: 3 }];

export const icp = { symbol: 'ICP', mark: swap.give.mark, gradient: swap.give.gradient };
export const chat = { symbol: 'CHAT', mark: swap.get.mark, gradient: swap.get.gradient };
export const prizeToken = samples.PrizeMessage.token as { symbol: string; mark?: string; gradient?: string; edge?: string; edge2?: string };
export const swapLegs = { give: samples.SwapOffer.give, get: samples.SwapOffer.get } as {
  give: { amount: string; symbol: string; mark?: string; usd?: string; gradient?: string };
  get: { amount: string; symbol: string; mark?: string; usd?: string; gradient?: string };
};

export const poll = {
  question: 'When should we run the design review?',
  options: [
    { label: 'Tuesday evening', votes: 12, voters: people.slice(0, 3) },
    { label: 'Wednesday lunch', votes: 31, voters: people.slice(1, 5) },
    { label: 'Thursday evening', votes: 7, voters: people.slice(3, 4) },
  ],
};

export const faces = people.slice(0, 4);
export const groupedCalls = [
  { state: 'ended' as const, media: 'video' as const, startedBy: 'Lucy', duration: '12:40', time: '09:12' },
  { state: 'missed' as const, media: 'voice' as const, startedBy: 'Lucy', time: '09:40' },
  { state: 'ended' as const, media: 'voice' as const, startedBy: 'You', duration: '3:05', time: '10:02' },
];

export const mediaTray = {
  type: 'media' as const,
  items: [
    { kind: 'image' as const, bg: 'var(--cover-teal)' },
    { kind: 'image' as const, bg: 'var(--cover-violet)' },
    { kind: 'video' as const, bg: 'var(--cover-amber)', dur: '0:42' },
  ],
};

export const navRail = samples.NavRail as {
  items: { icon: 'messages' | 'bell' | 'wallet'; label?: string; dot?: boolean; count?: number }[];
  pins: { color: 'sunset' | 'blue' | 'teal' | 'plum'; name?: string; dot?: boolean }[];
};

export const allocation = (() => {
  const values = tokens.map((t) => t.held * t.price);
  const total = values.reduce((a, b) => a + b, 0);
  return tokens.map((t, i) => ({ share: values[i] / total, gradient: t.grad }));
})();
export const walletCoins = tokens.map((t) => ({ symbol: t.symbol, mark: t.mark, gradient: t.grad }));

export const longName = 'Bartholomew Montgomery-Fitzgerald the Third, Keeper of Very Long Display Names';
export const longGroup = 'The International Association of Decentralised Messaging Enthusiasts — Europe, Middle East & Africa chapter';

// ─── App · patterns, call, puzzle, threads, dialogs ──────────────────────────────────────────────────

// Demo data for the App group's pattern / call / puzzle / thread / dialog sections (merged into samples.ts later).


export const headerMenu: MenuItem[] = [
  { label: 'docs.features.menu.communityDetails', mask: icon('info') },
  { label: 'docs.features.menu.muteNotifications', mask: icon('bell-off') },
  { label: 'ui.chatListHeader.leaveCommunity', variant: 'danger', mask: icon('leave') },
];

export const patternRows = [
  { title: 'Danielle Moreau', section: 'Pinned', preview: 'Pushed the updated flow', time: '10:42', unreadCount: 3, color: 'violet', online: true, selected: true },
  { title: 'The Awesome Group', kind: 'group', section: 'Pinned', preview: 'Priya: see you at 4', time: '09:18', color: 'teal', typing: true },
  { title: 'Release Train', kind: 'group', preview: 'Julian: v2.0.2054 is on prod test', time: '08:02', unreadCount: 12, color: 'amber', muted: true },
  { title: 'Marcus Webb', preview: 'Okay mate, that sounds good', time: 'Yest', color: 'blue', verified: true },
  { title: 'Lucy Linden', preview: 'Voice message · 0:14', time: 'Mon', color: 'plum', liveCall: 'voice' },
  { title: '#announcements', kind: 'channel', preview: 'Diamond members get early access', time: 'Sun', color: 'teal' },
] as const;

export const infoDetails = [
  { label: 'docs.features.info.username', value: '@alice_anderson' },
  { label: 'docs.features.info.memberSince', value: 'Nov 2021' },
];

const day = (time: string, text: string, extra: Record<string, unknown> = {}): GroupMessage => ({ text, time, ...extra }) as GroupMessage;

// Pattern dividers: a short history with date dividers and the unread marker before the newest messages.
export const dividerThread: ({ divider: string; tone: 'accent' | 'neutral' } | MessageGroupItem)[] = [
  { divider: 'Monday', tone: 'neutral' },
  { side: 'received', name: 'Priya Raman', color: 'teal', messages: [day('16:02', 'Did anyone check the staging build?'), day('16:03', 'The chat list jumps when a new message lands')] },
  { side: 'sent', messages: [day('16:10', 'On it — looks like the scroll anchor resets on resize', { status: 'delivered' })] },
  { divider: 'docs.features.divider.yesterday', tone: 'neutral' },
  { side: 'received', name: 'Danielle Moreau', color: 'violet', messages: [day('09:41', 'Fixed in the latest push. Pinning to newest now survives image loads.'), day('09:42', 'Can someone confirm on mobile?', { reactions: [{ emoji: '👍', count: 2 }] })] },
  { side: 'sent', messages: [day('11:20', 'Confirmed on iOS and Android', { status: 'delivered' }), day('11:20', 'Nice work 🎉', { status: 'delivered' })] },
  { divider: 'ui.unreadDivider.unread', tone: 'accent' },
  { side: 'received', name: 'Jonah Weiss', color: 'amber', messages: [day('08:05', 'Morning! Release train leaves at 3'), day('08:06', 'Please get your PRs merged before lunch'), day('08:06', "I'll post the changelog in the thread")] },
];

export const receivedGroup: GroupMessage[] = [
  { text: 'The illustration slot is in — take a look at the spacing on mobile', time: '10:41' },
  { text: 'Agreed, the shorter one reads better', time: '10:41', quoteName: 'You', quoteText: "Let's ship the shorter version of the copy" },
  { text: 'Happy to iterate on the colours', time: '10:42', reactions: [{ emoji: '❤️', count: 3, mine: true }, { emoji: '🔥', count: 1 }] },
];

export const sentGroup: GroupMessage[] = [
  { text: 'Looks great, merging now', time: '10:44', status: 'delivered' },
  { text: 'Forwarding the release note', time: '10:45', status: 'delivered', forwarded: true },
  { text: 'Typo fixed', time: '10:46', status: 'sent', edited: true },
  { text: 'Shipping in 5', time: '10:46', status: 'sending' },
];

export const callPeople = [
  { name: 'julian_jelfs', initial: 'J', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)' },
  { name: 'alice_anderson', initial: 'A', grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)', muted: true },
  { name: 'priya_raman', initial: 'P', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
];

export const tiles = [
  { nameLabel: 'alice_anderson', ratio: 4 / 3, box: '4 / 3', w: '280px', grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)', speaking: true },
  { nameLabel: 'julian_jelfs', ratio: 16 / 9, box: '16 / 9', w: '320px', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)', muted: true },
  { nameLabel: 'priya_raman', ratio: 3 / 4, box: '3 / 4', w: '180px', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
];

export const coinSizes = [
  { symbol: 'ICP', mark: '∞', size: 80 },
  { symbol: 'CHAT', mark: 'C', size: 64, gradient: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', edge: '#1a8f7a', edge2: '#126b5c' },
  { symbol: 'BTC', mark: '₿', size: 48, gradient: 'linear-gradient(140deg,#F7A63B,#F7931A)', edge: '#b8650c', edge2: '#8a4c09' },
  { symbol: 'USDT', mark: 'T', size: 32, gradient: 'linear-gradient(140deg,#4BD6A8,#1E9E7E)', edge: '#167560', edge2: '#0f5747' },
];

export const threadGroups = [
  {
    name: 'The Awesome Group',
    grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    radius: '11px',
    threads: [
      { author: 'Ana Ferreira', grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)', time: '11:15', text: "Agreed. Let's decide on the scale before anyone touches a component.", count: '6 replies', unread: 2, selected: true },
      { author: 'Priya Raman', grad: 'linear-gradient(140deg,#FFC061,#FF8A3D)', time: '09:02', text: 'Release checklist for v2.0.2054', count: '4 replies' },
    ],
  },
  {
    name: 'Danielle Moreau',
    grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)',
    radius: '50%',
    threads: [{ author: 'Danielle Moreau', grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)', time: 'Yest', text: 'Onboarding copy, round two', count: '2 replies', followOnly: true }],
  },
];

export const threadRoot = { author: 'Ana Ferreira', color: 'violet', text: "Agreed. Let's decide on the scale before anyone touches a component.", time: '11:15' };
export const threadReplies: MessageGroupItem[] = [
  { side: 'received', name: 'Jonah Weiss', color: 'amber', messages: [{ text: 'Spacing first, then type?', time: '11:18' }] },
  { side: 'sent', messages: [{ text: 'Yes — 2/4/6/8 up to 32, nothing in between', time: '11:20', status: 'delivered' }] },
  { side: 'received', name: 'Ana Ferreira', color: 'violet', messages: [{ text: "Works for me. I'll draft the tokens", time: '11:24' }] },
];
export const threadFaces = ['linear-gradient(140deg,#B48CFF,#6A5CFF)', 'linear-gradient(140deg,#FFC061,#FF8A3D)', 'linear-gradient(140deg,#2EE6A8,#1FB6FF)'];

export const joinGate = {
  community: { name: 'OpenChat Devs', members: 2481, grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  gates: [
    { kind: 'pay', symbol: 'CHAT', amount: 50 },
    { kind: 'balance', symbol: 'ICP', amount: 10 },
    { kind: 'neuron', label: 'docs.features.joinGate.neuron', detail: 'docs.features.joinGate.neuronDetail', confirm: 'docs.features.joinGate.neuronConfirm' },
  ] as const,
  tokens: [
    { symbol: 'CHAT', held: 132.33, mark: 'C', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
    { symbol: 'ICP', held: 4820, mark: '∞', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' },
  ],
};

// MessageActions takes the bare mask image (it adds the positioning itself)
export const messageActionItems = [
  { label: 'ui.common.reply', mask: 'var(--icon-reply)' },
  { label: 'docs.features.menu.copyText', mask: 'var(--icon-copy)' },
  { label: 'docs.features.menu.forward', mask: 'var(--icon-forward)' },
  { variant: 'separator', label: '' },
  { label: 'ui.common.delete', variant: 'danger', mask: 'var(--icon-trash)' },
] as const;
