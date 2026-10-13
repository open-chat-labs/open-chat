// Demo-only data for the docs page (components carry no sample data of their own).
const icon = (n: string) => `var(--icon-${n}) center/contain no-repeat`;

const chats = [
  { name: 'Lucy Linden', kind: 'Direct chat', grad: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)' },
  { name: 'Design Guild', kind: 'Group · 112 members', grad: 'linear-gradient(140deg,#b06bff,#5b2a86)', radius: '11px' },
  { name: 'Matt Rivers', kind: 'Direct chat', grad: 'linear-gradient(140deg,#ffb03d,#ff4d4d)' },
  { name: '#general', kind: 'OpenChat community', grad: 'linear-gradient(140deg,#ff5f9e,#6a2bff)', radius: '11px' },
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

export const samples: Record<string, Record<string, unknown>> = {
  Menu: { items: menuItems },
  StepIndicator: { steps: ['Details', 'Quote', 'Swap'] },
  WalletMain: { tokens: walletTokens },
  WalletPanel: { tokens: walletTokens },
  WalletReceive: { tokens: walletTokens },
  WalletSend: { tokens: walletTokens },
  WalletSwap: { tokens: walletTokens },
  DiamondDialog: { tokens: walletTokens },
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
  MessageActions: { open: true, point: { x: 240, y: 240 } },
};
