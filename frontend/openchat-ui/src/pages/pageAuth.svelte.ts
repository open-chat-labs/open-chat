// Sign in / Create account on the Landing and Learn pages. The page owns whether AuthDialog is open; the host does the
// real work through the same callbacks AuthDialog takes, except that onMethod and onSignup must return a promise: when
// it resolves, the dialog closes and the page enters the app (onEnterApp() when the host gives one, else appHref). A
// callback that returns nothing never counts as signed in.
// An email link only sends the link; entering happens when the person follows it. A sign-in that resolves after the
// dialog was closed still enters: the person did sign in, and staying on the page with nothing happening is worse.
// Attempts started before the page entered are one sign-in, so however many of them resolve it enters once; once it
// has entered, opening the dialog again (a page the host keeps mounted, after a sign-out) starts a new one.
import type { ComponentProps } from 'svelte';
import type AuthDialog from '../features/components/AuthDialog.svelte';
import type { AuthMethod, SignupDetails } from '../features/components/AuthDialog.svelte';

type AuthDialogProps = ComponentProps<typeof AuthDialog>;

/** What the host passes through to the pages' AuthDialog. */
export type PageAuth = Pick<
  AuthDialogProps,
  | 'variant'
  | 'referrers'
  | 'searchReferrers'
  | 'checkUsername'
  | 'termsUrl'
  | 'onRequestEmailLink'
  | 'onCancelEmailLink'
  | 'methods'
  | 'wallets'
  | 'email'
  | 'referrer'
  | 'passkeySignup'
> & {
  /** The page's dialog is opening (Sign in, Create account): the host reads what it shows then. */
  onOpen?: () => void;
  /** The page's dialog was closed (Esc, the scrim, the close button): stop whatever the host had going for it. */
  onClose?: () => void;
  /** Sign in / up with a method (and the wallet picked, for Ethereum / Solana with `wallets`); resolve once the person is
   *  signed in (the page then enters the app), reject to go back. */
  onMethod?: (method: AuthMethod, kind: 'login' | 'signup', wallet?: string) => Promise<unknown>;
  /** Create the account; resolve once it exists and is signed in (the page then enters the app), reject to stay on the form. */
  onSignup?: (details: SignupDetails) => Promise<unknown>;
};

const isPromise = (v: unknown): v is Promise<unknown> => typeof (v as Promise<unknown> | undefined)?.then === 'function';

export class PageAuthState {
  kind = $state<'login' | 'signup' | null>(null);
  // which sign-in an attempt belongs to: a new one starts when the dialog opens after the page has entered
  private generation = 0;
  private entered = false;

  constructor(private props: () => { auth?: PageAuth; onEnterApp?: () => void; appHref: string }) {}

  open = (kind: 'login' | 'signup') => {
    if (this.entered) {
      this.generation++;
      this.entered = false;
    }
    // without passkey sign-up, Create account is sign-in: someone new signs in, then the host has the form
    // before it shows, so it shows what the host read
    this.props().auth?.onOpen?.();
    this.kind = kind === 'signup' && this.props().auth?.passkeySignup === false ? 'login' : kind;
  };

  // the person closed it: the host stops what it had going
  close = () => {
    this.kind = null;
    this.props().auth?.onClose?.();
  };

  /** Open app's click, signed in: onEnterApp when the host gives one, else the link to appHref does it. A modified or
   *  non-primary click (new tab …) is the browser's. */
  openApp = (e: MouseEvent) => {
    const { onEnterApp } = this.props();
    if (!onEnterApp || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onEnterApp();
  };

  private enter(generation: number) {
    // an earlier sign-in's late result leaves the current dialog alone
    if (generation !== this.generation) return;
    // signed in: closed without telling the host to stop
    this.kind = null;
    if (this.entered) return;
    this.entered = true;
    const { onEnterApp, appHref } = this.props();
    if (onEnterApp) onEnterApp();
    else location.assign(appHref);
  }

  // built once, so AuthDialog gets the same callbacks on every read; they read the host's current ones when called
  // the wallet only when AuthDialog passes one, so the host sees the call AuthDialog made
  private onMethod = async (method: AuthMethod, kind: 'login' | 'signup', ...wallet: [wallet?: string]) => {
    const generation = this.generation;
    const pending = this.props().auth?.onMethod?.(method, kind, ...wallet);
    // a plain JS host can still return nothing; that has signed no one in
    if (!isPromise(pending)) return;
    await pending;
    this.enter(generation);
  };

  private onSignup = async (details: SignupDetails) => {
    const generation = this.generation;
    const pending = this.props().auth?.onSignup?.(details);
    if (!isPromise(pending)) return;
    await pending;
    this.enter(generation);
  };

  /** AuthDialog props for the current kind: the host's callbacks, with success wired to entering the app. */
  get dialog(): AuthDialogProps {
    const auth = this.props().auth ?? {};
    return {
      ...auth,
      kind: this.kind ?? 'login',
      onClose: this.close,
      // offered only when the host has them: without one, AuthDialog does nothing for that action
      onMethod: auth.onMethod ? this.onMethod : undefined,
      onSignup: auth.onSignup ? this.onSignup : undefined,
    };
  }
}
