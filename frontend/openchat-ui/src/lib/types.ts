// Shared prop types. The export referenced these by name without defining them;
// each shape mirrors what the matching .logic.js file produces or reads.

/** One entry of Menu `items` (and DmPanel `menuItems`), rendered as a MenuItem. */
export interface MenuItem {
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

/** One sender's run of messages, as rendered by MessageGroup (ThreadPanel `replies`). */
export interface MessageGroupItem {
  side?: string;
  name?: string;
  color?: string;
  messages: {
    kind?: 'text' | 'voice' | 'image' | 'album' | 'video' | 'gif' | 'file' | 'link' | 'transfer' | 'swap' | 'poll' | 'prize';
    text?: string;
    time: string;
    status?: string;
    forwarded?: boolean;
    edited?: boolean;
    deleted?: boolean;
  }[];
}

/** One row offered by TokenPicker. */
export interface TokenOption {
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
export interface Prize {
  token: TokenRef;
  amount: number;
  amountText: string;
  winners: number;
  even: boolean;
  endsIn: string;
  endsInLabel: string;
  endsAt: number;
  gates: { label: string; met: boolean }[];
  fee: number;
  feeText: string;
  totalText: string;
  summary: string;
  draft: PrizeDraft;
}

/** SendCryptoDialog form state, carried in `Transfer.draft`. `to` is the recipient handle. */
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
  recipient: { name: string; handle: string };
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
  expiresIn: string;
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
  rules: { id: string; type: string; asset: string; a: string; b: string }[];
  intervalOn: boolean;
  every: string;
}

/** GroupSettingsDialog `onSave` value; also accepted (partially) as `value`. */
export interface GroupSettings {
  info: { name: string; about: string; color: string; coverKey: string; coverUrl: string | null; avatar: string };
  settings: { isPublic: boolean; history: boolean; disappearOn: boolean; after: string };
  gates: AccessGatesState | null;
  rules: { enabled: boolean; text: string };
  permissions: {
    /** Lowest role allowed per action (roles, edit, invite, …). */
    general: Record<string, GroupRole>;
    /** `default` role plus per content type a role or 'inherit'. */
    messages: Record<string, GroupRole | 'inherit'>;
    /** Same shape as messages; null when threads follow the message rules. */
    threads: Record<string, GroupRole | 'inherit'> | null;
  };
}
