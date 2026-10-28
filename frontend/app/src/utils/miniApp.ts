// The app a bot opens from one of its MiniApp messages, shown in a frame by the desktop and mobile
// MiniAppFrame components. As with external content, the framed site is treated as fully malicious:
// see utils/externalContent.ts for why each sandbox flag is present.
import { EXTERNAL_CONTENT_SANDBOX } from "./externalContent";

export const MINI_APP_SANDBOX = EXTERNAL_CONTENT_SANDBOX;

// A bot serves its app at /app beside its other endpoints. Undefined unless the endpoint is https,
// or http on this machine for a bot run locally, and isn't OpenChat's own origin, whose pages a
// frame allowed scripts and its own origin could reach into.
export function miniAppUrl(botEndpoint: string, ownOrigin: string): URL | undefined {
    let url: URL;
    try {
        url = new URL(`${botEndpoint.replace(/\/+$/, "")}/app`);
    } catch {
        return undefined;
    }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const scheme = url.protocol === "https:" || (url.protocol === "http:" && local);
    return scheme && url.origin !== ownOrigin ? url : undefined;
}

// What OpenChat sends the app
export type MiniAppHostMessage =
    // once the app says it's ready: the token which tells its server who the user is
    | { kind: "initialise_mini_app"; token: string; dark_mode: boolean; locale: string }
    // a fresh token, which the app asked for
    | { kind: "mini_app_token"; token: string }
    | { kind: "set_dark_mode"; dark_mode: boolean };

// What the app sends OpenChat
export type MiniAppMessage = { kind: "mini_app_ready" } | { kind: "mini_app_token_request" };

// The app's message, if `ev` is one from the frame. Anything else posted to the window (other
// frames, popups, the parent when OpenChat is itself framed) is ignored.
export function miniAppMessage(
    ev: MessageEvent,
    frame: MessageEventSource | null | undefined,
    origin: string,
): MiniAppMessage | undefined {
    if (frame == null || ev.source !== frame || ev.origin !== origin) return undefined;
    if (typeof ev.data !== "object" || ev.data === null) return undefined;
    const kind = (ev.data as { kind?: unknown }).kind;
    return kind === "mini_app_ready" || kind === "mini_app_token_request" ? { kind } : undefined;
}
