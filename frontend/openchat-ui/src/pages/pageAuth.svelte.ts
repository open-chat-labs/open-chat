// Sign in / Create account on the Landing and Learn pages. The page owns whether AuthDialog is open; the host does the
// real work through the same callbacks AuthDialog takes, except that onMethod and onSignup must return a promise: when
// it resolves, the dialog closes and the page enters the app (onEnterApp() when the host gives one, else appHref). A
// callback that returns nothing never counts as signed in.
// An email link only sends the link; entering happens when the person follows it. A sign-in that resolves after the
// dialog was closed still enters (the person is signed in either way), but the page enters at most once, however many
// attempts across reopened dialogs resolve.
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
  private entered = false;

  constructor(private props: () => { auth?: PageAuth; onEnterApp?: () => void; appHref: string }) {}

  open = (kind: 'login' | 'signup') => {
    this.kind = kind;
  };

  close = () => {
    this.kind = null;
  };

  private enter() {
    if (this.entered) return;
    this.entered = true;
    this.close();
    const { onEnterApp, appHref } = this.props();
    if (onEnterApp) onEnterApp();
    else location.assign(appHref);
  }

  /** AuthDialog props for the current kind: the host's callbacks, with success wired to entering the app. */
  get dialog(): AuthDialogProps {
    const auth = this.props().auth ?? {};
    const { onMethod, onSignup } = auth;
    return {
      ...auth,
      kind: this.kind ?? 'login',
      onClose: this.close,
      onMethod: onMethod
        ? async (method, kind) => {
            const pending = onMethod(method, kind);
            // a plain JS host can still return nothing; that has signed no one in
            if (!isPromise(pending)) return;
            await pending;
            this.enter();
          }
        : undefined,
      onSignup: onSignup
        ? async (details) => {
            const pending = onSignup(details);
            if (!isPromise(pending)) return;
            await pending;
            this.enter();
          }
        : undefined,
    };
  }
}
