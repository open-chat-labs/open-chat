// Sign in / Create account on the Landing and Learn pages. The page owns whether AuthDialog is open; the host does the
// real work through the same callbacks AuthDialog takes. When a method or the sign-up form succeeds (the host's promise
// resolves), the dialog closes and the page enters the app: onEnterApp() when the host gives one, else appHref.
// An email link only sends the link; entering happens when the person follows it. A result that arrives after the
// dialog was closed (or reopened) is stale and does nothing.
import type { ComponentProps } from 'svelte';
import type AuthDialog from '../features/components/AuthDialog.svelte';

type AuthDialogProps = ComponentProps<typeof AuthDialog>;

/** What the host passes through to the pages' AuthDialog. */
export type PageAuth = Pick<
  AuthDialogProps,
  'variant' | 'referrers' | 'searchReferrers' | 'checkUsername' | 'termsUrl' | 'onMethod' | 'onRequestEmailLink' | 'onSignup'
>;

export class PageAuthState {
  kind = $state<'login' | 'signup' | null>(null);
  // bumped on every open and close, so a host call that settles later knows whether its dialog is still the one showing
  private session = 0;

  constructor(private props: () => { auth?: PageAuth; onEnterApp?: () => void; appHref: string }) {}

  open = (kind: 'login' | 'signup') => {
    this.session++;
    this.kind = kind;
  };

  close = () => {
    this.session++;
    this.kind = null;
  };

  private enter(session: number) {
    if (session !== this.session) return;
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
            const session = this.session;
            await onMethod(method, kind);
            this.enter(session);
          }
        : undefined,
      onSignup: onSignup
        ? async (details) => {
            const session = this.session;
            await onSignup(details);
            this.enter(session);
          }
        : undefined,
    };
  }
}
