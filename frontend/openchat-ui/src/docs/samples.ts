// Demo-only data for the docs page (components carry no sample data of their own).
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
  { label: 'Add to favourites', mask: icon('heart') },
  { label: 'Mute notifications', mask: icon('bell-off') },
  { label: 'Mark as read', mask: icon('check') },
  { label: 'Leave group', variant: 'danger', mask: icon('leave') },
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
    { label: 'Text', count: 1286 },
    { label: 'Images', count: 56 },
    { label: 'Files', count: 25 },
    { label: 'GIFs', count: 21 },
    { label: 'Polls, video & audio', count: 29 },
  ],
  weeks: [186, 241, 198, 274, 312, 268, 355, 298, 389, 341, 402, 447],
  people: [
    { name: 'Priya Raman', count: 312, gradient: 'linear-gradient(145deg,#8FE3C6,#3FB99A)' },
    { name: 'Danielle Moreau', count: 268, gradient: 'linear-gradient(145deg,#C9B4FF,#8A6BE0)' },
    { name: 'Jonah Weiss', count: 191, gradient: 'linear-gradient(145deg,#FFD79A,#E8A13C)' },
  ],
  engagement: [
    { count: '462', label: 'Reactions' },
    { count: '75', label: 'Replies' },
    { count: '11', label: 'Poll votes' },
    { count: '5', label: 'Deleted' },
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
      { label: 'Member since', value: '1 Nov 2021' },
      { label: 'Chit earned', value: '339,400', highlight: true },
      { label: 'Status', value: 'Online now', dot: true },
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
  ExploreCommunities: { communities: [] },
  WalletSettingsDialog: { tokens: [] },
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
    items: [{ icon: 'messages', label: 'DM & Group Chats', dot: true, count: 3 }, { icon: 'bell', label: 'Notifications' }, { icon: 'wallet', label: 'Wallet' }],
    pins: [{ color: 'sunset', name: 'Community 01' }, { color: 'blue', name: 'Community 02' }, { color: 'teal', name: 'Community 03', dot: true }, { color: 'plum', name: 'Community 04' }],
  },
  CallPanel: { people: [{ name: 'julian_jelfs', initial: 'J', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)' }] },
  LeaderboardDialog: {
    initialPeriod: 'september',
    boards: {
      august: {
        label: 'AUGUST',
        rows: [['SKYE_TERRIER', 64200], ['AKMANNURIYE', 61500], ['KEYTAATGLU', 52800], ['ZARINAZARI', 44100], ['KAY', 38900], ['HAFSAT001', 33200], ['0XCLD', 31800], ['VA867', 29400], ['PIKO_NETWORK', 25600], ['BRITTANY91', 24900]],
        you: { rank: 312, score: 17800 },
      },
      september: {
        label: 'SEPTEMBER',
        rows: [['AKMANNURIYE', 70800], ['SKYE_TERRIER', 70800], ['ZARINAZARI', 70600], ['KEYTAATGLU', 38400], ['HAFSAT001', 37000], ['KAY', 36800], ['VA867', 36000], ['0XCLD', 34600], ['BRITTANY91', 31500], ['PIKO_NETWORK', 27700]],
        you: { rank: 245, score: 21400 },
      },
      all: {
        label: 'ALL TIME',
        rows: [['AKMANNURIYE', 3853800], ['SKYE_TERRIER', 3577200], ['KEYTAATGLU', 2894400], ['ZARINAZARI', 2706900], ['KAY', 2344500], ['0XCLD', 2117700], ['HAFSAT001', 2064600], ['VA867', 1838100], ['BRITTANY91', 1678200], ['PIKO_NETWORK', 1494300]],
        you: { rank: 188, score: 539400 },
      },
    },
  },
  MessageActions: { open: true, point: { x: 240, y: 240 } },
  PanelCover: { actions: ['close'], trailActions: ['favourite'] },
  TileButtons: { tiles: ['video', 'mute', 'search'] },
  TypingIndicator: { names: ['Danielle', 'Priya'], colors: ['violet', 'teal'] },
  ComposerBar: { typingNames: ['Danielle', 'Priya'] },
  StatsDonut: {
    slices: [
      { label: 'Text', count: 1286 },
      { label: 'Image', count: 56 },
      { label: 'Video', count: 11 },
      { label: 'Audio', count: 3 },
      { label: 'File', count: 25 },
      { label: 'Poll', count: 12 },
      { label: 'Crypto', count: 3 },
      { label: 'GIF', count: 21 },
    ],
    extras: [
      { label: 'POLL VOTES', count: '11' },
      { label: 'REPLIES', count: '75' },
      { label: 'REACTIONS', count: '462' },
      { label: 'DELETED', count: '5' },
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
