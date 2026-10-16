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
export type PageAuth = Pick<AuthDialogProps, 'variant' | 'referrers' | 'searchReferrers' | 'checkUsername' | 'termsUrl' | 'onRequestEmailLink'> & {
  /** Sign in / up with a method; resolve once the person is signed in (the page then enters the app), reject to go back. */
  onMethod?: (method: AuthMethod, kind: 'login' | 'signup') => Promise<unknown>;
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
    this.kind = kind;
  };

  close = () => {
    this.kind = null;
  };

  private enter(generation: number) {
    // an earlier sign-in's late result leaves the current dialog alone
    if (generation !== this.generation) return;
    this.close();
    if (this.entered) return;
    this.entered = true;
    const { onEnterApp, appHref } = this.props();
    if (onEnterApp) onEnterApp();
    else location.assign(appHref);
  }

  // built once, so AuthDialog gets the same callbacks on every read; they read the host's current ones when called
  private onMethod = async (method: AuthMethod, kind: 'login' | 'signup') => {
    const generation = this.generation;
    const pending = this.props().auth?.onMethod?.(method, kind);
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
