// Shared prop types. The export referenced these by name without defining them;
// each shape mirrors what the matching .logic.js file produces or reads.
import type { Component } from 'svelte';
import type ChatBubble from './components/ChatBubble.svelte';
import type FileMessage from './components/FileMessage.svelte';
import type LinkPreview from './components/LinkPreview.svelte';
import type MediaMessage from './components/MediaMessage.svelte';
import type PollMessage from './components/PollMessage.svelte';
import type PrizeMessage from './components/PrizeMessage.svelte';
import type SwapOfferMessage from './components/SwapOffer.svelte';
import type TransferMessage from './components/TransferMessage.svelte';
import type VoiceMessage from './components/VoiceMessage.svelte';

/** One entry of Menu `items` (and DmPanel `menuItems`), rendered as a MenuItem. */
export interface MenuItem {
  /** Stable action id; menus report and match it instead of the (translated) label. */
  id?: string;
  label: string;
  variant?: 'regular' | 'danger' | 'separator';
  icon?: string;
  mask?: string;
  checkMask?: string;
  shortcut?: string;
  minVw?: number;
  maxVw?: number;
  onSelect?: () => void;
}

/** Fields every message in a MessageGroup can carry, whatever its kind. */
interface GroupMessageBase {
  /** The message's id: keeps its row when messages are added before it, and is written to the row's data-msg. */
  id?: string;
  time: string;
  /** Deleted messages render as a tombstone and get no menu. */
  deleted?: boolean;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
}

/** Props a message kind takes from MessageGroup itself rather than from the message. */
type GroupOwned = 'side' | 'lastInGroup' | 'onToggleReaction';

type KindProps<C> = C extends Component<infer P> ? Omit<P, GroupOwned | 'time'> : never;

/** One message inside a MessageGroup; `kind` picks the component that renders it (text when absent). */
export type GroupMessage = GroupMessageBase &
  (
    | ({ kind?: 'text' } & KindProps<typeof ChatBubble>)
    | ({ kind: 'voice' } & KindProps<typeof VoiceMessage>)
    | ({ kind: 'image' | 'album' | 'video' | 'gif' } & Omit<KindProps<typeof MediaMessage>, 'kind'>)
    | ({ kind: 'file' } & KindProps<typeof FileMessage>)
    | ({ kind: 'link' } & KindProps<typeof LinkPreview>)
    | ({ kind: 'transfer' } & KindProps<typeof TransferMessage>)
    | ({ kind: 'swap' } & KindProps<typeof SwapOfferMessage>)
    | ({ kind: 'poll' } & KindProps<typeof PollMessage>)
    | ({ kind: 'prize' } & KindProps<typeof PrizeMessage>)
  );

/** One sender's run of messages, as rendered by MessageGroup (ThreadPanel `replies`). */
export interface MessageGroupItem {
  side?: 'received' | 'sent';
  name?: string;
  color?: 'violet' | 'amber' | 'teal' | 'blue';
  messages: GroupMessage[];
}

/** One row offered by TokenPicker. */
export interface TokenOption {
  /** Reported by onSelect when several options share a symbol (e.g. a ledger); defaults to the symbol. */
  id?: string;
  symbol: string;
  name?: string;
  /** Shown instead of name, e.g. why the token is unavailable. */
  note?: string;
  mark?: string;
  gradient?: string;
  /** Formatted balance; a non-empty value also counts the token as owned. */
  held?: string;
  owned?: boolean;
  disabled?: boolean;
  current?: boolean;
  title?: string;
}

export interface TokenRef {
  symbol: string;
  mark: string;
  gradient: string;
}

/** PrizeBuilderDialog form state, carried in `Prize.draft` so `initial` can reopen it. */
export interface PrizeDraft {
  tok: string;
  amt: string;
  win: string;
  /** Index into the dialog's duration list (1h … 90d). */
  dur: number;
  even: boolean;
  /** Enabled gates by key (auth, diamond, lifetime, chit, streak). */
  gates: Record<string, boolean | number>;
  streak: number;
  chit: number;
}

/** PrizeBuilderDialog `onAttach` value; pass it back as `initial` to edit. */
export type PrizeGateKind = 'auth' | 'diamond' | 'lifetime' | 'chit' | 'streak';

export interface Prize {
  token: TokenRef;
  amount: number;
  amountText: string;
  winners: number;
  even: boolean;
  endsIn: string;
  endsInLabel: string;
  /** Provisional end (attach time + durationMs); set the real end from durationMs when the prize is posted. */
  endsAt: number;
  durationMs: number;
  /** Display labels for the entry rules. */
  gates: { label: string; met: boolean }[];
  /** Machine-readable entry rules (min: CHIT amount or streak days). */
  rules: { kind: PrizeGateKind; min?: number }[];
  fee: number;
  feeText: string;
  totalText: string;
  summary: string;
  draft: PrizeDraft;
}

/** SendCryptoDialog form state, carried in `Transfer.draft`. `to` is the recipient's user id. */
export interface TransferDraft {
  tok: string;
  amt: string;
  to: string | null;
}

/** SendCryptoDialog `onAttach` value; pass it back as `initial` to edit. */
export interface Transfer {
  type: 'transfer';
  token: TokenRef;
  amount: number;
  amountText: string;
  usd: number;
  usdText: string;
  /** `id` is the user id (principal) the funds go to. */
  recipient: { id: string; name: string; handle: string };
  fee: number;
  feeText: string;
  totalText: string;
  title: string;
  summary: string;
  draft: TransferDraft;
}

/** One side of a swap offer, amounts already formatted. */
export interface SwapSide extends TokenRef {
  amount: string;
  usd: string;
}

/** SwapOfferDialog form state, carried in `SwapOffer.draft`. */
export interface SwapOfferDraft {
  give: string;
  get: string;
  amt: string;
  want: string;
  dur: number;
  /** Chosen price premium over market, or null once the ask is typed by hand. */
  prem: number | null;
}

/** SwapOfferDialog `onAttach` value; pass it back as `initial` to edit. */
export interface SwapOffer {
  type: 'swap';
  give: SwapSide;
  get: SwapSide;
  pair: [TokenRef, TokenRef];
  /** Exact amounts for the escrow (give/get carry the formatted text). */
  giveAmount: number;
  getAmount: number;
  /** Short display label, e.g. "1d". */
  expiresIn: string;
  expiresInMs: number;
  title: string;
  summary: string;
  hint: string;
  draft: SwapOfferDraft;
}

export type GroupRole = 'member' | 'moderator' | 'admin' | 'owner' | 'nobody';

/** AccessGates `onChange` value, stored as GroupSettings `gates`. */
export interface AccessGatesState {
  count: number;
  joiner: string;
  rules: AccessGateRule[];
  /** false while a rule is missing its token or a required amount: don't save the gates then (the dialogs block it). */
  complete: boolean;
  intervalOn: boolean;
  /** Re-check interval as shown ('1 month'); everyDays is the same in days. */
  every: string;
  everyDays?: number;
}

/** GroupSettingsDialog `onSave` value; also accepted (partially) as `value`. */
export interface GroupSettings {
  info: {
    name: string;
    about: string;
    color: string;
    coverKey: string;
    /** The existing cover image URL; null for a swatch or when a new coverFile replaces it. */
    coverUrl: string | null;
    /** The existing photo URL; '' when removed or when a new avatarFile replaces it. */
    avatar: string;
    /** A newly picked photo, for the host to upload (onSave only). */
    avatarFile?: File | null;
    /** A newly picked cover image (onSave only). */
    coverFile?: File | null;
  };
  /** `after` is the duration label ("12 hours"); `afterMs` the same in milliseconds (onSave only). */
  settings: { isPublic: boolean; history: boolean; disappearOn: boolean; after: string; afterMs?: number | null };
  gates: AccessGatesState | null;
  /** newVersion: the text changed and members must accept the rules again (onSave only). */
  rules: { enabled: boolean; text: string; newVersion?: boolean };
  permissions: {
    /** Lowest role allowed per action (roles, edit, invite, …). */
    general: Record<string, GroupRole>;
    /** `default` role plus per content type a role or 'inherit'. */
    messages: Record<string, GroupRole | 'inherit'>;
    /** Same shape as messages; null when threads follow the message rules. */
    threads: Record<string, GroupRole | 'inherit'> | null;
  };
}

/** A file staged in MessageComposer, shown as a chip. */
export interface FileAttachment {
  type: 'file';
  title: string;
  summary: string;
  /** Tile colour behind the file icon. */
  tint?: string;
}

/** Photos / videos staged in MessageComposer, shown as a thumbnail tray (up to 10). */
export interface MediaAttachment {
  type: 'media';
  items: { kind: 'image' | 'video'; src?: string; bg?: string; dur?: string }[];
}

/** What MessageComposer can stage above the text: a prize, transfer or swap offer chip, a file chip or a media tray. */
export type ComposerAttachment = (Prize & { type?: 'prize' }) | Transfer | SwapOffer | FileAttachment | MediaAttachment;

/** Reply / edit strip above MessageComposer's input; a new `key` re-focuses the input (edit also pre-fills `text`). */
export interface ComposerContext {
  key: string;
  mode: 'reply' | 'edit';
  /** Who is being replied to. */
  name?: string;
  quote: string;
  /** CSS background for a media thumbnail. */
  thumb?: string;
  /** Edit mode: the original text. */
  text?: string;
}

/** Something a wallet token's menu or page offers. */
export type WalletTokenAction = 'send' | 'receive' | 'swap' | 'refresh' | 'hide';

/** One token in the user's wallet, as the wallet screens (WalletMain, WalletPanel, WalletSend …) take it. */
export interface WalletToken {
  /** Identifies the token in callbacks, requests and activity when several share a symbol (e.g. its ledger);
   *  defaults to the symbol. */
  id?: string;
  symbol: string;
  name: string;
  mark: string;
  /** Brand gradient (CSS background); also its colour in the allocation and share bars. */
  grad: string;
  /** Logo image URL, shown in place of the mark. */
  logo?: string;
  /** Balance, in whole tokens. */
  held: number;
  /** USD per token. */
  price: number;
  /** Decimal places shown for amounts. */
  dp: number;
  /** Decimal places the amount input accepts, when fewer than dp (e.g. 8 for an 18-decimal token); defaults to dp. */
  inputDp?: number;
  /** Ledger transfer fee, in whole tokens. */
  fee?: number;
  /** Accepted for payments (e.g. Diamond membership). */
  payable?: boolean;
  /** Networks it can be sent on: icp, btc, eth … */
  nets?: string[];
  /** Price change over the last 24h, in percent (token page pill; hidden without it). */
  change24h?: number;
  /** Ledger canister id (token page; hidden without it). */
  ledger?: string;
  /** Token standard, e.g. "ICRC-1" (token page; hidden without it). */
  standard?: string;
  /** What its menu and page offer; all of them without it (Hide in a manual wallet only). */
  actions?: WalletTokenAction[];
}

/** One configured access gate (AccessGates rules, AccessGatesCards gates). `a` / `b` are the type's numeric fields as decimal strings with a "." mark ("1.5", also when typed "1,5"). */
export interface AccessGateRule {
  id: string;
  /** Gate type key: lifetime, diamond, neuron, payment, balance, credential, unique, locked, chit … */
  type: string;
  /** Canister id of the token ledger / SNS governance, for gate types that need one. */
  asset: string;
  a: string;
  b: string;
}

/** AccessGatesCards `onChange` value. */
export interface AccessGatesCardsState {
  count: number;
  /** How gates combine. */
  mode: 'All' | 'Any';
  gates: AccessGateRule[];
  /** false while a gate is missing its token or a required amount: don't save the gates then. */
  complete: boolean;
  /** Periodic re-check of the gates. */
  intervalOn: boolean;
  everyDays: number;
}

/** CreateGroupDialog `onCreate` value. */
export interface CreateGroupResult {
  name: string;
  about: string;
  /** Avatar gradient key when there is no photo. */
  color: string;
  coverKey: string;
  /** The picked photo file (upload it yourself; the dialog's preview URL is revoked when it closes). */
  avatarFile: File | null;
  kind: 'group' | 'community' | 'channel' | 'embedded';
  embedded: boolean;
  /** Communities only. */
  /** Communities only: a language code such as 'en' or 'fr'. */
  language: string | null;
  /** The picked cover image file, or null for a swatch (coverKey). */
  coverFile: File | null;
  /** Communities: the public channels to create. */
  channels: string[];
  /** Embedded channels: the page shown. */
  url: string;
  previewForNonMembers: boolean;
  isPublic: boolean;
  visibleHistory: boolean;
  /** e.g. "12 hours", or null when messages are kept. */
  disappearAfter: string | null;
  /** The same duration in milliseconds, or null when messages are kept. */
  disappearAfterMs: number | null;
  /** User ids added (channels) or invited (groups, communities). */
  members: string[];
  /** Channels: user ids invited from outside the community. */
  invites: string[];
  /** `{ count: 0 }` when no gate was touched. */
  gates: AccessGatesState | { count: 0 };
  rules: { enabled: boolean; text: string };
  permissions: GroupSettings['permissions'];
}

