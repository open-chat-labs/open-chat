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

// Opened from a button in the docs. Every *Dialog is treated as an overlay too.
export const overlays = ['DialogShell', 'ChatPicker', 'MessageActions'];

export const samples: Record<string, Record<string, unknown>> = {
  Menu: { items: menuItems },
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
