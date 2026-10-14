import { createRawSnippet } from 'svelte';
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
  { id: 'u-emma_kovacs', name: 'Emma Kovacs', handle: '@emma_kovacs', color: 'plum' },
  { id: 'u-sam_okafor', name: 'Sam Okafor', handle: '@sam_okafor', color: 'blue' },
  { id: 'u-robert_lang', name: 'Robert Lang', handle: '@robert_lang', color: 'slate' },
  { id: 'u-alice_anderson', name: 'Alice Anderson', handle: '@alice_anderson', color: 'violet', frequent: true },
  { id: 'u-lucy_linden', name: 'Lucy Linden', handle: '@lucy_linden', color: 'teal', frequent: true },
  { id: 'u-priya_raman', name: 'Priya Raman', handle: '@priya_raman', color: 'amber', frequent: true },
  { id: 'u-danielle_m', name: 'Danielle Moreau', handle: '@danielle_m', color: 'blue', frequent: true },
  { id: 'u-jonah_weiss', name: 'Jonah Weiss', handle: '@jonah_weiss', color: 'violet', frequent: true },
  { id: 'u-nadia_r', name: 'Nadia Rahman', handle: '@nadia_r', color: 'teal' },
  { id: 'u-otto_l', name: 'Otto Lindqvist', handle: '@otto_l', color: 'blue' },
  { id: 'u-marcus_webb', name: 'Marcus Webb', handle: '@marcus_webb', color: 'amber' },
  { id: 'u-sofia_c', name: 'Sofia Castellanos', handle: '@sofia_c', color: 'violet' },
  { id: 'u-ravi_menon', name: 'Ravi Menon', handle: '@ravi_menon', color: 'teal' },
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
  { symbol: 'ICP', name: 'Internet Computer', mark: '\u221E', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', held: 0.5, price: 5.48, dp: 4, fee: 0.0001, payable: true, nets: ['icp'], change24h: 2.4, ledger: 'ryjl3-tyaaa-aaaaa-aaaba-cai', standard: 'ICRC-1' },
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', held: 132.33, price: 0.053, dp: 4, fee: 0.001, payable: true, nets: ['icp'], change24h: -0.8, ledger: '2ouva-viaaa-aaaaq-aaamq-cai', standard: 'ICRC-1' },
  { symbol: 'BTC', name: 'Bitcoin', mark: '\u20BF', grad: 'linear-gradient(140deg,#F7A63B,#F7931A)', held: 0.0213, price: 62000, dp: 8, fee: 0.0000001, payable: true, nets: ['btc', 'icp'], change24h: 1.1, ledger: 'mxzaz-hqaaa-aaaar-qaada-cai', standard: 'ICRC-1' },
  { symbol: 'USDT', name: 'Tether', mark: 'T', grad: 'linear-gradient(140deg,#4BD6A8,#1E9E7E)', held: 250, price: 1, dp: 2, fee: 0.01, nets: ['eth', 'icp'], change24h: 0.0, ledger: 'cngnf-vqaaa-aaaar-qag4q-cai', standard: 'ICRC-1' },
];

// Opened from a button in the docs. Every *Dialog is treated as an overlay too.
// stand-ins for host work in the demos (the components themselves never fake it)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const demoLinkCode = async () => {
  await wait(500);
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return { code: Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''), expiresAt: Date.now() + 180_000 };
};

// sample receiving addresses for the wallet demos (hosts pass the user's own)
export const receiveAddresses = { icp: '5sj6i-pqaaa-aaaaf-a3cmq-cai', eth: '0x7Bf3c9A1e64D25aB8f0C3e7d19A4b62F5dE81Ca0', btc: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', xrpl: 'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT' };
// people for WalletSend's "OpenChat user" mode, with recent transfers
const sendContacts = [
  { userId: 'u-jane', name: 'Jane Doe', handle: '@common_jane', grad: 'linear-gradient(140deg,#FFB35C,#FF6B6B)', history: [{ date: '28 Sep', amount: 50, incoming: false }, { date: '14 Sep', amount: 20, incoming: true }, { date: '2 Sep', amount: 120, incoming: false }] },
  { userId: 'u-annie', name: 'Annie Schwartz', handle: '@anti_ice_cold', grad: 'linear-gradient(140deg,#8B7BFF,#FF6FD8)' },
  { userId: 'u-nikki', name: 'Nikki Laudia', handle: '@the_pineal', grad: 'linear-gradient(140deg,#5CD0FF,#4B7BFF)' },
  { userId: 'u-chris', name: 'Chris Hanls', handle: '@guru_of_thunder', grad: 'linear-gradient(140deg,#63E6A8,#2AA6FF)' },
  { userId: 'u-neil', name: 'Neil Armstrong', handle: '@i_walked_on_moon', grad: 'linear-gradient(140deg,#FFD166,#F2795C)' },
];
// demo PIN is 123456: anything else rejects, so the error state can be seen
const demoSend = async (x: { pin: string }) => {
  await wait(700);
  if (x.pin !== '123456') throw new Error('wrong PIN');
};
const sendDemo = {
  contacts: sendContacts,
  onPickSaved: async () => {
    await wait(300);
    return '6fe2b-qpkus-3dzpo-iuc7d-nwyfk-7tqaf-2lhi4-cpm5c-ys7gz-wbf3a-dae';
  },
  onSent: demoSend,
};

const walletRecipients = [
  { id: 'r1', name: 'Ada — rent', address: '5sj6i-pqaaa-aaaaf-a3cmq-cai', token: 'CHAT', last: 'Sent 3 days ago' },
  { id: 'r2', name: 'Mum', address: 'rdmx6-jaaaa-aaaaa-aaadq-cai', token: 'ICP', last: 'Sent last week' },
  { id: 'r3', name: 'Hot wallet', address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', token: null, last: 'Sent 2 months ago' },
  { id: 'r4', name: 'Ledger cold', address: 'bc1q9h7garjqr0fy4ypz8w3c2y0w8qk3n6vqx4m2lc', token: null, last: 'Never sent' },
  { id: 'r5', name: 'Kraken deposit', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', token: null, last: 'Sent yesterday' },
];

// ---- wallet demo stand-ins (activity, recipients, swap, share, QR); the components never fake these themselves
const HOUR = 3600000;
const ago = (h: number) => Date.now() - h * HOUR;
const walletActivity = [
  { id: 'a1', symbol: 'CHAT', kind: 'receive', title: 'Received from Lucy Linden', timestamp: ago(1), context: 'in The Awesome Group', amount: 10.6, fiat: 0.56 },
  { id: 'a2', symbol: 'ICP', kind: 'send', title: 'Sent to Matt Rivers', timestamp: ago(20), context: 'direct chat', amount: 0.04, fiat: 0.22, status: 'sent' },
  { id: 'a3', symbol: 'BTC', kind: 'receive', title: 'Received from Ana Ferreira', timestamp: ago(26), context: 'direct chat', amount: 0.0012, fiat: 74.4 },
  { id: 'a4', symbol: 'USDT', kind: 'swap', title: 'Swapped to ICP', timestamp: ago(24 * 6), amount: 25, fiat: 25 },
  { id: 'a5', symbol: 'CHAT', kind: 'send', title: 'Sent to Ryan Rogers', timestamp: ago(24 * 13), context: '#general', amount: 4, fiat: 0.21, status: 'sent' },
  { id: 'a6', symbol: 'ICP', kind: 'receive', title: 'Received from Lucy Linden', timestamp: ago(24 * 14), context: 'direct chat', amount: 0.2, fiat: 1.1 },
] as const;
const receivableTokens = [
  { symbol: 'ckBTC', name: 'Chain-key Bitcoin', mark: '\u20BF', grad: 'linear-gradient(140deg,#F9C97E,#E07A2F)' },
  { symbol: 'USDC', name: 'USD Coin', mark: '$', grad: 'linear-gradient(140deg,#7EB7FF,#2775CA)' },
  { symbol: 'SOL', name: 'Solana', mark: 'S', grad: 'linear-gradient(140deg,#9CE7C8,#7B5BFF)' },
];
const recipientsDemo = {
  onAdd: async (r: { name: string; address: string; token?: string | null }) => {
    await wait(400);
    return { ...r, id: `r${Date.now()}`, last: '' };
  },
  onUpdate: () => wait(400),
  onRemove: () => wait(400),
};
const priceOf = (sym: string) => walletTokens.find((tk) => tk.symbol === sym)?.price ?? 1;
const swapDemo = {
  dexes: ['KongSwap', 'ICPSwap', 'Sonic'],
  onQuote: async (r: { from: string; to: string; amount: number }) => {
    await wait(1200);
    const usdIn = r.amount * priceOf(r.from);
    const impactPct = Math.min(9, (usdIn / 40000) * 100);
    return { dex: 'KongSwap', dexFee: '0.30%', out: (usdIn / priceOf(r.to)) * (1 - impactPct / 100) * 0.997, impactPct, networkFeeUsd: 0.01, expiresAt: Date.now() + 30000 };
  },
  onSwap: async (r: { onStep: (step: number) => void }) => {
    for (let i = 0; i < 5; i++) {
      r.onStep(i);
      await wait(900);
    }
  },
};
const shareChats = [
  { id: 'c1', name: 'Lucy Linden', kind: 'Direct chat', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)', radius: '50%' },
  { id: 'c2', name: 'The Awesome Group', kind: 'Group · 248 members', grad: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)', radius: '11px' },
  { id: 'c3', name: 'Matt Rivers', kind: 'Direct chat', grad: 'linear-gradient(140deg,#ffb03d,#ff4d4d)', radius: '50%' },
];
// the docs have no QR library: the host's renderer goes in this square, so the demo says so instead of faking one
const demoQr = createRawSnippet((address: () => string) => ({
  render: () =>
    `<span style="display:flex;align-items:center;justify-content:center;width:204px;height:204px;padding:16px;box-sizing:border-box;text-align:center;font:500 12px/1.4 var(--font-mono);color:#0b0b10;word-break:break-all">QR drawn by the host for ${address().replace(/[<>&"]/g, '')}</span>`,
}));
const receiveDemo = { chats: shareChats, onShare: () => wait(500), qr: demoQr };
const sendExtras = {
  btcFees: { btc: 0.0000042, ckbtc: 0.0000001 },
  onSearchUsers: async (q: string) => {
    await wait(250);
    const needle = q.toLowerCase();
    return sendContacts.filter((c) => c.name.toLowerCase().includes(needle) || c.handle.includes(needle));
  },
};

// WalletSettingsDialog's PIN lives "on the server" here; the demo accepts the PIN that was last set (initially 123456)
let demoPin = '123456';
const pinDemo = {
  onSetPin: async (pin: string) => {
    await wait(400);
    demoPin = pin;
  },
  onChangePin: async (current: string, next: string) => {
    await wait(400);
    if (current !== demoPin) throw new Error('wrong PIN');
    demoPin = next;
  },
  onDisablePin: async (current: string) => {
    await wait(400);
    if (current !== demoPin) throw new Error('wrong PIN');
  },
};

// SendCryptoDialog / SwapOfferDialog demo tokens and members (hosts pass live balances, fees and prices)
const cryptoTokens = [
  { symbol: 'CHAT', name: 'OpenChat', mark: 'C', gradient: 'linear-gradient(140deg,#ff5f9e,#ffb03d)', bal: 132.332136, fee: 0.001, min: 0.01, usd: 0.053, dp: 4 },
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', bal: 4.2153, fee: 0.0001, min: 0.0001, usd: 4.8, dp: 4 },
  { symbol: 'ckBTC', name: 'Chain-key Bitcoin', mark: '₿', gradient: 'linear-gradient(140deg,#ffb03d,#f7931a)', bal: 0.00213, fee: 0.0000001, min: 0.0000001, usd: 62000, dp: 8 },
  { symbol: 'ckUSDC', name: 'Chain-key USDC', mark: '$', gradient: 'linear-gradient(140deg,#2775ca,#1FB6FF)', bal: 48.5, fee: 0.01, min: 0.01, usd: 1, dp: 2 },
  { symbol: 'STK', name: 'Stake', mark: 'S', gradient: 'linear-gradient(140deg,#1b2a6b,#4fc3ff)', bal: 0, fee: 0.0001, min: 1, usd: 0.0021, dp: 2 },
];
const cryptoMembers = [
  { id: 'u-alice', name: 'Alice Anderson', handle: '@alice_anderson', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' },
  { id: 'u-lucy', name: 'Lucy Linden', handle: '@lucy_linden', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  { id: 'u-ryan', name: 'Ryan Rogers', handle: '@ryan_rogers', grad: 'linear-gradient(140deg,#ffb03d,#ff4d4d)' },
];
// DiamondDialog: backend prices in CHAT, and a purchase that resolves with the new membership end
const diamondDemo = {
  prices: { '1m': 2, '3m': 5, '1y': 15, life: 60 },
  onUpgrade: async (p: { lifetime: boolean; until: string | null }) => {
    await wait(1200);
    return { until: p.lifetime ? null : p.until };
  },
  onRefreshBalance: () => wait(900),
};

// sample deposit address for the top-up rows (hosts pass the user's own)
export const depositAddress = 'wq4pz-ixa3f-ubm7c-2jtw4-7d41e-cai';

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
  // the demo viewer is an owner with every permission; the component defaults to the least powerful
  viewerRole: 'Owner',
  canModerate: true,
  canChangeRoles: true,
  canInvite: true,
  canManageBots: true,
  canEdit: true,
  canDelete: true,
  canManageUserGroups: true,
  canPin: true,
  visibleHistory: true,
  disappearOn: true,
  disappearAfter: '12 hours',
  onMuteChange: () => wait(200),
  onMuteEveryoneChange: () => wait(200),
  onRoleChange: () => wait(300),
  onRemoveMember: () => wait(300),
  onUnblock: () => wait(300),
  onRemoveBlocked: () => wait(300),
  members: [
    { title: 'Jane Smith', handle: '@jane_smith', tag: 'OWNER', color: 'violet' },
    { title: 'John Smith', handle: '@john_smith', tag: 'YOU', color: 'blue' },
    { title: 'Alice Anderson', handle: '@alice_anderson', tag: 'ADMIN', color: 'rose', online: true, activity: 'typing' },
    { title: 'Lucy Linden', handle: '@lucy_linden', tag: 'ADMIN', color: 'teal', online: true, activity: 'now' },
    { title: 'Ryan Rogers', handle: '@ryan_rogers', tag: '', color: 'amber', online: true, activity: '2m' },
    { title: 'Christina Cameron', handle: '@christina_cameron', tag: '', color: 'plum', activity: '3h' },
    { title: 'Marcus Webb', handle: '@marcus_webb', tag: '', color: 'slate', activity: '1d' },
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
    { id: 'bot-llamabot', variant: 'bot', title: 'LlamaBot', subtitle: 'Sends prompts to the Llama 3 LLM and posts the reply in the thread.', color: 'slate' },
    { id: 'bot-welcomebot', variant: 'bot', title: 'WelcomeBot', subtitle: 'Greets new members with a custom message when they join.', color: 'plum' },
  ],
  webhooks: [
    { id: 'hook-ci_builds', variant: 'webhook', title: 'ci_builds', subtitle: '', color: 'blue', url: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/155810f3b90cb851aa633fc4aa435482' },
    { id: 'hook-monitoring_alerts', variant: 'webhook', title: 'monitoring_alerts', subtitle: '', color: 'plum', url: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/8d2c47ae91b05f7361ce0b4482da19f7' },
  ],
  recommendedBots: [
    { id: 'bot-reminderbot', variant: 'bot', title: 'ReminderBot', subtitle: 'Sends one-off and recurring reminder messages.', color: 'slate' },
    { id: 'bot-youtubebot', variant: 'bot', title: 'YoutubeBot', subtitle: 'Subscribe to a YouTube channel to get updates about new video releases.', color: 'rose' },
    { id: 'bot-discordbot', variant: 'bot', title: 'DiscordBot', subtitle: 'Proxy messages from your Discord community into OpenChat.', color: 'blue' },
    { id: 'bot-adventurebot', variant: 'bot', title: 'AdventureBot', subtitle: 'Play a selection of classic text-based adventures in chat.', color: 'amber' },
    { id: 'bot-moderationbot', variant: 'bot', title: 'ModerationBot', subtitle: 'Performs automated moderation using rules you configure.', color: 'teal' },
  ],
  userGroups: [
    { key: 'ug0', title: 'Developers', mention: '@developers', color: 'blue', members: [] },
    { key: 'ug1', title: 'Designers', mention: '@designers', color: 'plum', members: [] },
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
  { id: 'a1', day: 'Today', title: 'Bob and two others reacted to your message', context: 'The Awesome Group', preview: 'You / The illustration slot is in — take a look at the spacing on mobile', time: '44 min', unread: true, color: 'teal', kind: 'group', reactions: ['😎', '👍', '🙏', '+2'], type: 'reaction', chatId: 'g-awesome', messageId: 'm-1041' },
  { id: 'a2', day: 'Today', title: 'Marcus mentioned you', context: 'Design Guild', preview: 'Marcus / @you can we get the audit numbers into the deck?', time: '2 h', unread: true, color: 'violet', kind: 'group', type: 'mention', chatId: 'g-design', messageId: 'm-2210' },
  { id: 'a3', day: 'Yesterday', title: 'Danielle quote replied', context: 'Private chat', preview: "Danielle / Agreed — let's ship the shorter version", time: '1 d', unread: false, color: 'blue', kind: 'user', type: 'reply', chatId: 'dm-danielle', messageId: 'm-3302' },
  { id: 'a4', day: 'Monday', title: 'Priya sent 150 CHAT', context: 'Release Train', preview: 'Priya / for the release notes, thanks again', time: '3 d', unread: false, color: 'teal', kind: 'group', type: 'payment', chatId: 'g-release', messageId: 'm-4417' },
  { id: 'a5', day: 'Monday', title: 'Robert reacted to your message', context: 'Private chat', preview: 'You / Okay mate, that sounds good', time: '3 d', unread: false, color: 'amber', kind: 'user', reactions: ['😎', '👍'], type: 'reaction', chatId: 'dm-robert', messageId: 'm-5120' },
  { id: 'a6', day: 'Friday 14th Nov 2025', title: 'Marcus sent 10 USDT', context: 'Private chat', preview: 'Marcus / covering the audit tooling', time: '1 w', unread: false, color: 'blue', kind: 'user', type: 'payment', chatId: 'dm-marcus', messageId: 'm-6008' },
];

const chatListRows = [
  { id: 'dm-danielle', title: 'Danielle Moreau', section: 'Pinned', preview: 'Pushed the updated flow', time: '10:42', unreadCount: 3, color: 'violet', online: true, verified: false, selected: true },
  { id: 'g-awesome', title: 'The Awesome Group', kind: 'group', section: 'Pinned', preview: 'Priya: see you at 4', time: '09:18', unreadCount: 0, color: 'teal', online: true, verified: true, selected: false },
  { id: 'dm-marcus', title: 'Marcus Webb', preview: 'Okay mate, that sounds good', time: 'Yest', unreadCount: 0, color: 'amber', online: false, verified: false, selected: false },
];

// CreateGroupDialog's built-in demo people from the export
const createGroupPeople = [
  { userId: 'u-alice', name: 'Alice Anderson', handle: '@alice_anderson', color: 'violet' },
  { userId: 'u-lucy', name: 'Lucy Linden', handle: '@lucy_linden', color: 'teal' },
  { userId: 'u-priya', name: 'Priya Raman', handle: '@priya_raman', color: 'amber' },
  { userId: 'u-danielle', name: 'Danielle Moreau', handle: '@danielle_m', color: 'blue' },
  { userId: 'u-jonah', name: 'Jonah Weiss', handle: '@jonah_weiss', color: 'violet' },
  { userId: 'u-robert', name: 'Robert Rodriguez', handle: '@robert_r', color: 'amber' },
  { userId: 'u-nadia', name: 'Nadia Rahman', handle: '@nadia_r', color: 'teal' },
  { userId: 'u-otto', name: 'Otto Lindqvist', handle: '@otto_l', color: 'blue' },
];

// names the demo treats as taken (channel and group name checks)
const takenNames = ['general', 'announcements', 'openchat', 'the awesome group'];
const demoCheckName = async (name: string) => {
  await wait(300);
  return takenNames.includes(name.trim().toLowerCase()) ? ('taken' as const) : ('ok' as const);
};

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

// AccessGates / AccessGatesCards: the tokens (ledger canister ids) and nervous systems (governance canister ids) the
// host offers. The well-known ids are real; the rest are stand-ins for the demo.
const assetIds: Record<string, string> = {
  CHAT: '2ouva-viaaa-aaaaq-aaamq-cai',
  ICP: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
  BTC: 'mxzaz-hqaaa-aaaar-qaada-cai',
  ETH: 'ss2fx-dyaaa-aaaar-qacoq-cai',
  USDC: 'xevnm-gaaaa-aaaar-qafnq-cai',
  USDT: 'cngnf-vqaaa-aaaar-qag4q-cai',
  OpenChat: '2jvtu-yqaaa-aaaaq-aaama-cai',
};
const featuredTokens = ['CHAT', 'ICP', 'BTC', 'BOB', 'USDC', 'USDT'];
const featuredSystems = ['OpenChat', 'ICPanda', 'Dragginz', 'WaterNeuron', 'Gold DAO'];
export const gateTokens = 'CHAT|OpenChat·ICP|Internet Computer·BTC|ckBTC — Bitcoin·ETH|ckETH — Ethereum·USDC|ckUSDC·USDT|ckUSDT·BOB|BOB·KINIC|Kinic·GLDGov|Gold DAO·OGY|Origyn·MOD|Modclub·BOOM|Boom DAO·CTZ|Catalyze·NUA|Nuance·TRAX|Trax·SONIC|Sonic·HOT|HotOrNot·GHOST|Ghost·ICL|ICLighthouse·ELNA|ELNA AI·NTN|Neutrinite·DCD|DecideAI·DKP|Dragginz Karma Points·ICS|ICPSwap·SEER|Seers·WTN|WaterNeuron·ALICE|ALICE DAO·YUKU|Yuku DAO·NFIDW|NFID Wallet·PANDA|ICPanda·TACO|TACO DAO·MOTOKO|Motoko·KONG|KongSwap·EXE|Windoge98·DOGMI|DOGMI·SNEED|Sneed DAO·NICP|Neuron ICP·CLOWN|Clown·ND64|ND64·TENDY|Tendy·DAMONIC|Damonic·WUMBO|Wumbo·CLOUD|Cloud·SWAMP|Swampies·FOMO|FOMO·ckLINK|ckLINK·ckUNI|ckUNI·ckPEPE|ckPEPE·ckSHIB|ckSHIB·ckWBTC|ckWBTC·ckWSTETH|ckwstETH·ckXAUT|ckXAUt·ckOCT|ckOCT·ckEURC|ckEURC'
  .split('·')
  .map((entry) => {
    const [symbol, name] = entry.split('|');
    return { id: assetIds[symbol] ?? `ledger-${symbol.toLowerCase()}`, symbol, name, featured: featuredTokens.includes(symbol) };
  });
export const gateSystems = 'OpenChat|CHAT — messaging;Motoko|MOTOKO — developer tooling;ICPanda|PANDA — community;TACO DAO|TACO — treasury;Dragginz|DKP — game;WaterNeuron|WTN — liquid staking;Gold DAO|GLDGov — tokenized gold;Origyn|OGY — digital certificates;Modclub|MOD — moderation;Boom DAO|BOOM — gaming;Catalyze|CTZ — communities;Nuance|NUA — publishing;Trax|TRAX — music;Sonic|SONIC — DEX;HotOrNot|HOT — short video;Ghost|GHOST — meme;ICLighthouse|ICL — trading;ELNA AI|ELNA — AI agents;Neutrinite|NTN — analytics;DecideAI|DCD — AI;ICPSwap|ICS — DEX;Seers|SEER — prediction markets;ALICE DAO|ALICE — quant trading;Yuku DAO|YUKU — NFTs;NFID Wallet|NFIDW — identity;KongSwap|KONG — DEX;Sneed DAO|SNEED — community;Windoge98|EXE — meme;Cecil the Lion|CECIL — meme;FomoWell|FOMO — social;Swampies|SWAMP — game;Cycles Transfer Station|CTS — infrastructure;Personal DAO|PDAO — tooling;EstateDAO|EST — real estate;Kinic|KINIC — search;SNS-1|SNS1 — first SNS;Dolr AI|DOLR — video;Funded|FND — crowdfunding;CyclOps|CYC — cycles management;Konecta|KONECTA — AI;Pogo|POGO — social;Nuance Labs|NUAL — publishing'
  .split(';')
  .map((entry) => {
    const [name, about] = entry.split('|');
    const symbol = about.split(' — ')[0];
    return { id: assetIds[name] ?? `governance-${symbol.toLowerCase()}`, symbol, name, featured: featuredSystems.includes(name) };
  });

// BotDialog: what each bot's definition declares (creator, the permissions it asks for, its commands)
export const botCatalog = {
  ReminderBot: {
    id: 'bot-reminder',
    name: 'ReminderBot',
    creator: '@jane_smith',
    color: 'slate',
    description: 'Sends one-off and recurring reminder messages into this chat.',
    perms: ['read', 'send'],
    commands: [
      { name: '/remind_at', about: 'One-off reminder at a date and time', needs: ['send'] },
      { name: '/remind_recurring', about: 'Repeating reminder on a schedule', needs: ['send'] },
      { name: '/list_reminders', about: 'Show every reminder set in this chat', needs: ['read', 'send'] },
      { name: '/delete_reminder', about: 'Cancel a reminder you set', needs: ['read'] },
    ],
  },
  LlamaBot: {
    id: 'bot-llama',
    name: 'LlamaBot',
    creator: '@openchat_labs',
    color: 'slate',
    description: 'Sends prompts to the Llama 3 LLM and posts the reply in the thread.',
    perms: ['read', 'summary', 'send'],
    commands: [
      { name: '/ask', about: 'Answer a question in the thread', needs: ['send'] },
      { name: '/summarise', about: 'Summarise the recent conversation', needs: ['summary', 'send'] },
    ],
  },
  WelcomeBot: {
    id: 'bot-welcome',
    name: 'WelcomeBot',
    creator: '@jane_smith',
    color: 'plum',
    description: 'Greets new members with a custom message when they join.',
    perms: ['read', 'send'],
    commands: [
      { name: '/set_welcome', about: 'Set the message new members see', needs: ['send'] },
      { name: '/preview_welcome', about: 'Show the current welcome message', needs: ['read'] },
    ],
  },
  YoutubeBot: {
    id: 'bot-youtube',
    name: 'YoutubeBot',
    creator: '@tubetools',
    color: 'rose',
    description: 'Subscribe to a YouTube channel to get updates about new video releases.',
    perms: ['send'],
    commands: [
      { name: '/subscribe', about: 'Follow a channel and post its new videos', needs: ['send'] },
      { name: '/unsubscribe', about: 'Stop following a channel', needs: ['send'] },
    ],
  },
  DiscordBot: {
    id: 'bot-discord',
    name: 'DiscordBot',
    creator: '@bridgeworks',
    color: 'blue',
    description: 'Proxy messages from your Discord community into OpenChat.',
    perms: ['read', 'send'],
    commands: [
      { name: '/link_channel', about: 'Bridge a Discord channel to this chat', needs: ['send'] },
      { name: '/unlink_channel', about: 'Remove a bridged channel', needs: ['read'] },
    ],
  },
  AdventureBot: {
    id: 'bot-adventure',
    name: 'AdventureBot',
    creator: '@mira_dev',
    color: 'amber',
    description: 'Play a selection of classic text-based adventures in chat.',
    perms: ['read', 'send', 'images', 'react'],
    commands: [
      { name: '/play', about: 'Start an adventure in this chat', needs: ['send'] },
      { name: '/inventory', about: 'Show what your party is carrying', needs: ['read', 'send'] },
      { name: '/quit', about: 'End the current game', needs: ['read'] },
    ],
  },
  ModerationBot: {
    id: 'bot-moderation',
    name: 'ModerationBot',
    creator: '@openchat_labs',
    color: 'teal',
    description: 'Performs automated moderation using rules you configure.',
    perms: ['read', 'summary', 'members', 'pinned', 'threads', 'send', 'remove', 'pin', 'everyone'],
    commands: [
      { name: '/watchlist', about: 'Manage the words and links it acts on', needs: ['read'] },
      { name: '/purge', about: 'Remove the last N messages from a member', needs: ['remove'] },
      { name: '/pin_rules', about: 'Pin the group rules to the top', needs: ['pin'] },
    ],
  },
};

// WebhookDialog: the secret is issued "by the server" (here: the browser's CSPRNG, for the demo only)
const demoSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

// ProfileDialog's CHIT calendar: a synthetic claim history back to the join month (moved out of the component)
const demoToday = Date.UTC(2026, 8, 23);
const demoJoined = Date.UTC(2021, 10, 1);
const claimTier = (d: number) => (d >= 365 ? 600 : d >= 100 ? 500 : d >= 30 ? 400 : d >= 14 ? 300 : d >= 7 ? 200 : d >= 3 ? 150 : 100);
function demoClaimHistory(runLength: number, insuredDays: string[]) {
  const DAY = 864e5;
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  const out: { day: string; streakDay: number; amount?: number; minute?: number; insured?: boolean }[] = [];
  const runStart = demoToday - runLength * DAY;
  let t = demoJoined, run = 0, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (t < runStart - DAY) {
    if (rnd() < 0.1) run = 0;
    else {
      run++;
      out.push({ day: key(t), streakDay: run, amount: claimTier(run), minute: 300 + Math.floor(rnd() * 960) });
    }
    t += DAY;
  }
  for (let i = 0; i < runLength; i++) {
    const k = key(runStart + i * DAY);
    out.push(insuredDays.includes(k) ? { day: k, streakDay: i + 1, insured: true } : { day: k, streakDay: i + 1, amount: claimTier(i + 1), minute: 300 + ((i * 137 + 61) % 960) });
  }
  return out;
}

export const samples: Record<string, Record<string, unknown>> = {
  CreateGroupDialog: {
    gateTokens,
    gateSystems,
    people: createGroupPeople,
    invitePeople: createGroupPeople,
    preselected: ['u-alice', 'u-lucy'],
    isDiamond: true,
    checkName: demoCheckName,
    onSearchPeople: async (q: string) => {
      await wait(300);
      return [{ userId: 'u-sam', name: 'Sam Okafor', handle: '@sam_okafor', color: 'teal' }].filter((p) => `${p.name} ${p.handle}`.toLowerCase().includes(q));
    },
    onCreate: () => wait(600),
  },
  GroupSettingsDialog: { gateTokens, gateSystems, isDiamond: true, checkName: demoCheckName, onSave: () => wait(500), onMuteChange: () => wait(300), onFavouriteChange: () => wait(300) },
  NewChannelDialog: { checkName: demoCheckName, onCreate: () => wait(600) },
  ConvertToCommunityDialog: {
    onConfirm: async () => {
      await wait(900);
      return { communityId: 'c-awesome' };
    },
  },
  GroupPanel: groupPanel,
  DeleteGroupDialog: { onConfirm: () => wait(500) },
  UserGroupDialog: {
    people: [
      { userId: 'u-alice', name: 'Alice Anderson', handle: '@alice_anderson', color: 'rose' },
      { userId: 'u-lucy', name: 'Lucy Linden', handle: '@lucy_linden', color: 'teal' },
      { userId: 'u-ryan', name: 'Ryan Rogers', handle: '@ryan_rogers', color: 'amber' },
      { userId: 'u-christina', name: 'Christina Cameron', handle: '@christina_cameron', color: 'plum' },
      { userId: 'u-marcus', name: 'Marcus Webb', handle: '@marcus_webb', color: 'slate' },
      { userId: 'u-priya', name: 'Priya Raman', handle: '@priya_raman', color: 'teal' },
    ],
    takenNames: ['Developers', 'Designers'],
    onSave: () => wait(400),
    onDelete: () => wait(400),
  },
  GroupStats: groupStats,
  ActivityPanel: { items: activityItems, onMarkRead: () => wait(200), onMarkAllRead: () => wait(200) },
  ChatListPanel: { rows: chatListRows },
  ThreadPanel: { root: { author: 'Ana Ferreira', color: 'violet', text: "Agreed. Let's decide on the scale before anyone touches a component.", time: '11:15' } },
  ThreadList: { groups: [] },
  UserDialog: {
    onMessage: () => {},
    onBlock: () => wait(500),
    onUnblock: () => wait(500),
    onToggleFavourite: () => wait(300),
    onMuteChange: () => wait(300),
    facts: [
      { label: 'docs.features.userFacts.memberSince', value: '1 Nov 2021' },
      { label: 'docs.features.userFacts.chitEarned', value: '339,400', highlight: true },
      { label: 'docs.features.userFacts.status', value: 'docs.features.userFacts.onlineNow', dot: true },
    ],
  },
  Menu: { items: menuItems },
  StepIndicator: { steps: ['Details', 'Quote', 'Swap'] },
  WalletMain: { tokens: walletTokens, handle: '@you', addresses: receiveAddresses, ...sendDemo, ...sendExtras, activity: walletActivity, receivable: receivableTokens, recipients: walletRecipients, ...{ onAddRecipient: recipientsDemo.onAdd, onUpdateRecipient: recipientsDemo.onUpdate, onRemoveRecipient: recipientsDemo.onRemove }, ...swapDemo, ...receiveDemo },
  WalletPanel: { tokens: walletTokens, onRefresh: () => wait(800) },
  WalletReceive: { tokens: walletTokens, addresses: receiveAddresses, ...receiveDemo },
  WalletSend: { tokens: walletTokens, ...sendDemo, ...sendExtras },
  WalletSwap: { tokens: walletTokens, ...swapDemo },
  WalletRecipients: { tokens: walletTokens, recipients: walletRecipients, ...recipientsDemo },
  DiamondDialog: { tokens: walletTokens, depositAddress: depositAddress, ...diamondDemo },
  SendCryptoDialog: { tokens: cryptoTokens.slice(0, 4), members: cryptoMembers },
  SwapOfferDialog: { tokens: cryptoTokens },
  BotDialog: { bot: botCatalog.ReminderBot, canManage: true, onInstall: () => wait(500), onRemove: () => wait(500) },
  InviteDialog: {
    people: invitePeople,
    pending: invitePending,
    canInvite: true,
    shareLink: 'https://oc.app/group/the-awesome-group-8f2a',
    chats: chats.slice(0, 3).map((c, i) => ({ id: `chat-${i}`, ...c })),
    onInvite: () => wait(400),
    onAdd: () => wait(400),
    onShareToggle: () => wait(300),
    onResetLink: async () => {
      await wait(400);
      return { link: 'https://oc.app/group/the-awesome-group-3c91' };
    },
    onShareToChat: () => wait(400),
  },
  AccessGates: { isDiamond: true, tokens: gateTokens, nervousSystems: gateSystems },
  AccessGatesCards: { isDiamond: true, tokens: gateTokens, nervousSystems: gateSystems },
  ExploreCommunities: { communities: exploreCommunities, joinedKeys: ['oc'] },
  WalletSettingsDialog: { tokens: ['ICP', 'CHAT', 'BTC', 'USDT'], ...pinDemo },
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
  WebhookDialog: {
    dialogMode: 'edit',
    webhook: { id: 'wh-ci', name: 'ci_builds', color: 'blue', url: 'https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/155810f3b90cb851aa633fc4aa435482' },
    takenNames: ['ci_builds', 'monitoring_alerts'],
    onSave: () => wait(500),
    onRegenerate: async () => {
      await wait(500);
      return { url: `https://oc.app/webhook/eypkj-sqjl7-lhksa-5j6vq/${demoSecret()}` };
    },
  },
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
    checkUsername: async (name: string) => {
      await wait(300);
      return !['openchat', 'hamish', 'admin', 'julian_jelfs', 'matt'].includes(name);
    },
    onMethod: () => wait(1600),
    onRequestEmailLink: () => wait(600),
    onSignup: () => wait(1200),
  },
  NavRail: {
    items: [{ icon: 'messages', label: 'docs.features.navRail.chats', dot: true, count: 3 }, { icon: 'bell', label: 'ui.navRail.notifications' }, { icon: 'wallet', label: 'ui.navRail.wallet' }],
    pins: [{ id: 'c1', color: 'sunset', name: 'Community 01' }, { id: 'c2', color: 'blue', name: 'Community 02' }, { id: 'c3', color: 'teal', name: 'Community 03', dot: true }, { id: 'c4', color: 'plum', name: 'Community 04' }],
  },
  CallPanel: { people: [{ id: 'u-julian', name: 'julian_jelfs', initial: 'J', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)', speaking: true }], onToggleCamera: () => wait(200), onToggleShare: () => wait(200) },
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
  LeaveGroupDialog: { body: 'ui.leaveGroupDialog.body', onConfirm: () => wait(500) },
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
      { id: 'c-one', name: 'Community One', members: 1234, channels: 10 },
      { id: 'c-two', name: 'Community Two', members: 1234, channels: 10 },
    ],
    onConfirm: () => wait(800),
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
    onRequestLinkCode: demoLinkCode,
    // streak 57, today still claimable: the run ends yesterday
    claimable: true,
    claimHistory: demoClaimHistory(56, ['2026-09-07']),
    today: demoToday,
    joined: demoJoined,
    utcOffsetMinutes: 120,
    icHost: 'https://icp-api.io',
    storageIndex: 'rturd-qaaaa-aaaaf-aabaq-cai',
    publicKey: '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEquEHzJr9605Oy796e4z7LKow46DVNUnDOQWavi86vEhRAAfdbVh/Lgmxfi44LPb6S0wnCRm9kI/XdK1DYw2Eaw==\n-----END PUBLIC KEY-----',
    inviteRewards: [
      { label: 'ui.profileDialog.invite.rewardDiamond', amount: 5000 },
      { label: 'ui.profileDialog.invite.rewardLifetime', amount: 15000 },
    ],
    onSave: () => wait(400),
    checkHandle: async (h: string) => {
      await wait(300);
      return !['admin', 'openchat'].includes(h.toLowerCase());
    },
    onLogout: () => wait(800),
    onDeleteAccount: () => wait(1200),
    onClearCache: () => wait(1000),
    onCommunityName: () => wait(300),
    onLinkMethod: async (type: 'passkey' | 'ii') => {
      await wait(900);
      return type === 'passkey'
        ? { type, id: 'k3m9q-demo1-lnk1d-cai', title: 'Passkey on this device', short: 'passkey on this device', used: 'Just linked' }
        : { type, id: '7hq2m-demo2-ne9kd-cai', title: 'Internet Identity', short: 'Internet Identity', used: 'Just linked' };
    },
    onRequestEmailCode: () => wait(600),
    // the demo code is 123456; anything else is rejected
    onVerifyEmailCode: async (email: string, code: string) => {
      await wait(600);
      if (code !== '123456') throw new Error('wrong code');
      return { type: 'email' as const, id: email, title: email, short: 'email', used: 'Just linked' };
    },
    onUnlinkMethod: () => wait(400),
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
      { id: 'c-oc-devs', name: 'OpenChat Devs', color: 'teal' },
      { id: 'c-design', name: 'Design Guild', color: 'violet' },
      { id: 'c-pixel', name: 'Pixel Art Club', color: 'amber' },
      { id: 'c-icp', name: 'ICP Builders', color: 'blue' },
      { id: 'c-crypto', name: 'Crypto Chat', color: 'plum' },
      { id: 'c-owls', name: 'Night Owls', color: 'rose' },
      { id: 'c-runners', name: 'Weekend Runners', color: 'slate' },
    ],
    communityNames: { 'c-design': 'James · Product', 'c-icp': 'jsmith.icp', 'c-owls': 'Jimmy' },
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
  { symbol: 'ICP', name: 'Internet Computer', mark: '∞', gradient: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', held: '0.5' },
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
  pins: { id: string; color: 'sunset' | 'blue' | 'teal' | 'plum'; name?: string; dot?: boolean }[];
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
  { id: 'dm-danielle', title: 'Danielle Moreau', section: 'Pinned', preview: 'Pushed the updated flow', time: '10:42', unreadCount: 3, color: 'violet', online: true, selected: true },
  { id: 'g-awesome', title: 'The Awesome Group', kind: 'group', section: 'Pinned', preview: 'Priya: see you at 4', time: '09:18', color: 'teal', typing: true },
  { id: 'g-release', title: 'Release Train', kind: 'group', preview: 'Julian: v2.0.2054 is on prod test', time: '08:02', unreadCount: 12, color: 'amber', muted: true },
  { id: 'dm-marcus', title: 'Marcus Webb', preview: 'Okay mate, that sounds good', time: 'Yest', color: 'blue', verified: true },
  { id: 'dm-lucy', title: 'Lucy Linden', preview: 'Voice message · 0:14', time: 'Mon', color: 'plum', liveCall: 'voice' },
  { id: 'ch-announcements', title: '#announcements', kind: 'channel', preview: 'Diamond members get early access', time: 'Sun', color: 'teal' },
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
  { id: 'u-julian', name: 'julian_jelfs', initial: 'J', grad: 'linear-gradient(140deg,#9BD94B,#4E8F2B)', speaking: true },
  { id: 'u-alice', name: 'alice_anderson', initial: 'A', grad: 'linear-gradient(140deg,#B48CFF,#6A5CFF)', muted: true },
  { id: 'u-priya', name: 'priya_raman', initial: 'P', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
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
  depositAddress,
  ownerShare: 0.98,
  onRecheck: () => wait(700),
  community: { name: 'OpenChat Devs', members: 2481, grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  gates: [
    { kind: 'pay', symbol: 'CHAT', ledger: '2ouva-viaaa-aaaaq-aaamq-cai', amount: 50 },
    { kind: 'balance', symbol: 'ICP', ledger: 'ryjl3-tyaaa-aaaaa-aaaba-cai', amount: 10 },
    { kind: 'neuron', label: 'docs.features.joinGate.neuron', detail: 'docs.features.joinGate.neuronDetail', confirm: 'docs.features.joinGate.neuronConfirm' },
  ] as const,
  tokens: [
    { symbol: 'CHAT', held: 132.33, mark: 'C', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
    { symbol: 'ICP', held: 0.5, mark: '∞', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)' },
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

// ── rewards & games demos (the components get all of this from the host) ──
// the achievements catalogue with the sample account's progress
export const demoAchievements = [
  { id: 'tipAMessage', group: 'messaging', reward: 1000, done: false, band: 'mid' as const, icon: 'coin' },
  { id: 'sendAPrizeMessage', group: 'messaging', reward: 1000, done: false, band: 'mid' as const, icon: 'gift' },
  { id: 'receiveAMessageTip', group: 'messaging', reward: 1000, done: false, band: 'mid' as const, icon: 'coin' },
  { id: 'sendAMemeMessage', group: 'messaging', reward: 500, done: false, band: 'quick' as const, icon: 'image' },
  { id: 'followAThread', group: 'messaging', reward: 500, done: false, band: 'quick' as const, icon: 'chat' },
  { id: 'sendATextMessage', group: 'messaging', reward: 500, done: true },
  { id: 'reactToAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'sendADirectMessage', group: 'messaging', reward: 500, done: true },
  { id: 'receiveADirectMessage', group: 'messaging', reward: 500, done: true },
  { id: 'editAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'deleteAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'forwardAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'sendAnImage', group: 'messaging', reward: 500, done: false, band: 'quick' as const, icon: 'image' },
  { id: 'sendAFile', group: 'messaging', reward: 500, done: true },
  { id: 'sendAPoll', group: 'messaging', reward: 500, done: true },
  { id: 'sendACryptoMessage', group: 'messaging', reward: 1000, done: true },
  { id: 'receiveACryptoMessage', group: 'messaging', reward: 1000, done: true },
  { id: 'sendAVideo', group: 'messaging', reward: 500, done: true },
  { id: 'sendAnAudioMessage', group: 'messaging', reward: 500, done: true },
  { id: 'sendAnAnimatedGif', group: 'messaging', reward: 500, done: true },
  { id: 'quoteReplyToAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'startAReplyInAThread', group: 'messaging', reward: 500, done: true },
  { id: 'sendAReminder', group: 'messaging', reward: 500, done: true },
  { id: 'receiveAReactionOnAMessage', group: 'messaging', reward: 500, done: true },
  { id: 'voteOnAPoll', group: 'messaging', reward: 500, done: true },
  { id: 'updateYourProfileBio', group: 'profile', reward: 500, done: false, band: 'quick' as const, icon: 'user' },
  { id: 'uploadYourProfileAvatar', group: 'profile', reward: 500, done: true },
  { id: 'updateYourDisplayName', group: 'profile', reward: 500, done: true },
  { id: 'upgradeToDiamondMembership', group: 'profile', reward: 5000, done: true },
  { id: 'upgradeToLifetimeDiamondMembership', group: 'profile', reward: 20000, done: true },
  { id: 'acceptASwapOffer', group: 'wallet', reward: 2000, done: false, band: 'mid' as const, icon: 'wallet' },
  { id: 'setAPinNumberOnYourWallet', group: 'wallet', reward: 500, done: true },
  { id: 'swapATokenFromTheWallet', group: 'wallet', reward: 1000, done: true },
  { id: 'sendAP2PSwapOffer', group: 'wallet', reward: 1000, done: true },
  { id: 'joinACommunity', group: 'community', reward: 500, done: true },
  { id: 'joinAGroup', group: 'community', reward: 500, done: true },
  { id: 'joinACall', group: 'community', reward: 500, done: true },
  { id: 'markAChatAsAFavourite', group: 'community', reward: 500, done: true },
  { id: 'pinAChatToTheTopOfTheList', group: 'community', reward: 500, done: true },
  { id: 'setACommunityDisplayName', group: 'community', reward: 500, done: true },
  { id: 'achieveA3DayStreak', group: 'streaks', reward: 500, done: true },
  { id: 'achieveA7DayStreak', group: 'streaks', reward: 1000, done: true },
  { id: 'achieveA14DayStreak', group: 'streaks', reward: 2000, done: true },
  { id: 'achieveA30DayStreak', group: 'streaks', reward: 5000, done: true },
  { id: 'achieveA100DayStreak', group: 'streaks', reward: 10000, done: true },
  { id: 'achieveA365DayStreak', group: 'streaks', reward: 25000, done: true },
  { id: 'referYour1stVerifiedUser', group: 'referrals', reward: 5000, done: false, band: 'big' as const, icon: 'users' },
  { id: 'referYour3rdVerifiedUser', group: 'referrals', reward: 7500, done: false, band: 'big' as const, icon: 'users' },
  { id: 'referYour10thVerifiedUser', group: 'referrals', reward: 10000, done: false, band: 'big' as const, icon: 'users' },
  { id: 'referYour20thVerifiedUser', group: 'referrals', reward: 15000, done: false },
  { id: 'referYour50thVerifiedUser', group: 'referrals', reward: 25000, done: false },
];
// today's Bridges board; the demo "server" knows the solution, the component never does
export const demoPuzzle = {
  id: 'daily-20734',
  number: 20734,
  grid: 7,
  islands: [[0, 0, 3], [3, 0, 3], [6, 0, 3], [0, 2, 4], [2, 2, 4], [5, 2, 1], [2, 4, 3], [4, 4, 4], [6, 4, 4], [0, 6, 3], [4, 6, 4], [6, 6, 2]] as [number, number, number][],
};
const demoSolution: [number, number, number][] = [[0, 1, 2], [1, 2, 1], [0, 3, 1], [2, 8, 2], [3, 4, 2], [4, 5, 1], [4, 6, 1], [6, 7, 2], [7, 8, 1], [7, 10, 1], [3, 9, 1], [9, 10, 2], [10, 11, 1], [8, 11, 1]];
const pairKey = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
export const puzzleDemo = {
  puzzle: demoPuzzle,
  hintCost: 100,
  hintsAllowed: 3,
  onHint: async ({ bridges }: { bridges: Record<string, number> }) => {
    await wait(300);
    const next = demoSolution.find(([i, j, n]) => (bridges[pairKey(i, j)] || 0) !== n);
    if (!next) throw new Error('nothing to hint');
    return next;
  },
  onSolved: () => wait(400),
};
Object.assign(samples, {
  AchievementsDialog: { achievements: demoAchievements },
  ChitDialog: { claimable: true, achievements: { total: 51, left: 13 }, onClaim: () => wait(500) },
  StreakInsuranceDialog: { prices: [1, 2, 4, 12, 28, 60, 124], onBuy: () => wait(600) },
  PuzzleDialog: puzzleDemo,
});
