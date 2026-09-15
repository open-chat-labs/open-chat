// Shared by the desktop and mobile ExternalContent components. The framed site is treated
// as fully malicious; see frontend/app/rollup.extras.mjs and .ic-assets.json5 for the
// CSP and Permissions-Policy that apply on top of these attributes.

// Why each flag is present, and why the rest are absent:
// - allow-scripts / allow-same-origin: the framed dapp needs its own origin for storage,
//   auth and for its postMessage handshake (ev.origin would be "null" otherwise).
// - allow-forms: ordinary in-frame forms.
// - allow-popups / allow-popups-to-escape-sandbox: Internet Identity and wallet logins open
//   a popup. A popup is a new top-level window and cannot navigate the OpenChat window.
// - allow-storage-access-by-user-activation: lets the dapp request its unpartitioned
//   cookies via the Storage Access API (browser-prompted).
// Absent on purpose: allow-top-navigation(-by-user-activation) so a click inside the frame
// can never redirect the OpenChat tab; allow-downloads; allow-modals (no fake prompts);
// allow-pointer-lock; allow-orientation-lock; allow-presentation.
export const EXTERNAL_CONTENT_SANDBOX =
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation";

// Returns the origin the iframe will be pointed at, or undefined when the url must not be
// framed. Only https is accepted; the community canister enforces the same rule on write.
export function externalContentOrigin(url: string | undefined): string | undefined {
    if (url === undefined) return undefined;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" ? parsed.origin : undefined;
    } catch {
        return undefined;
    }
}

export type ExternalContentHostMessage =
    | { kind: "initialise_external_content"; theme: unknown; username: string }
    | { kind: "set_theme"; theme: unknown };

// True only for the single message the host accepts, from the framed origin. Anything else
// posted to the window (other frames, popups, the parent when OpenChat is itself framed) is
// ignored.
export function isExternalContentReady(ev: MessageEvent, origin: string): boolean {
    return (
        ev.origin === origin &&
        typeof ev.data === "object" &&
        ev.data !== null &&
        (ev.data as { kind?: unknown }).kind === "external_content_ready"
    );
}
