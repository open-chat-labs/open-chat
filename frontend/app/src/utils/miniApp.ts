// The app a bot opens from one of its MiniApp messages, shown in a frame by the desktop and mobile
// MiniAppFrame components. As with external content, the framed site is treated as fully malicious:
// see utils/externalContent.ts for why each sandbox flag is present.
import type { MiniAppRole } from "@client";
import { EXTERNAL_CONTENT_SANDBOX } from "./externalContent";

export const MINI_APP_SANDBOX = EXTERNAL_CONTENT_SANDBOX;

// A bot serves its app at /app beside its other endpoints. Undefined unless the endpoint is https,
// or http on this machine for a bot run locally while OpenChat is too (only development builds may
// frame those), and isn't OpenChat's own origin, whose pages a frame allowed scripts and its own
// origin could reach into.
export function miniAppUrl(botEndpoint: string, ownOrigin: string): URL | undefined {
    let url: URL;
    try {
        url = new URL(`${botEndpoint.replace(/\/+$/, "")}/app`);
    } catch {
        return undefined;
    }
    const scheme =
        url.protocol === "https:" ||
        (url.protocol === "http:" && isLocal(url.hostname) && isLocal(new URL(ownOrigin).hostname));
    return scheme && url.origin !== ownOrigin ? url : undefined;
}

function isLocal(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

// What OpenChat sends the app (backend/docs/mini_app_service_protocol.md, "App ↔ website")
export type MiniAppHostMessage =
    // once the app says it's ready, and again whenever the user's role changes. Only a player gets a
    // token, which the app sends with each request to its bot.
    | {
          kind: "initialise_mini_app";
          role: MiniAppRole;
          user_id: string;
          token: string | undefined;
          dark_mode: boolean;
          locale: string;
      }
    // a fresh player token, which the app asked for
    | { kind: "mini_app_token"; token: string }
    // the game's state: what everyone sees, and the user's own part if they're playing
    | { kind: "mini_app_state"; seq: number; shared: unknown; private: unknown }
    | { kind: "set_dark_mode"; dark_mode: boolean }
    // the answer to `mini_app_start`, with the bot's reason, or OpenChat's, if it didn't start
    | { kind: "mini_app_start_result"; accepted: boolean; message: string | undefined };

// What the app sends OpenChat
export type MiniAppMessage =
    | { kind: "mini_app_ready" }
    // the player's token is running out
    | { kind: "mini_app_token_request" }
    // the player asks to start the game
    | { kind: "mini_app_start" };

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
    return kind === "mini_app_ready" ||
        kind === "mini_app_token_request" ||
        kind === "mini_app_start"
        ? { kind }
        : undefined;
}
