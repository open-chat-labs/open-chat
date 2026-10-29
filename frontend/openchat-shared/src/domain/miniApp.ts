// Games in messages, as OpenChat's MiniApp service runs them (backend/docs/mini_app_service_protocol.md)
import type { ResourceKey } from "../utils/i18n";
import type { MultiUserChatIdentifier } from "./chat";

// A game, which is played from one of a bot's MiniApp messages
export type MiniAppGame = {
    chatId: MultiUserChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
};

// Whether the user plays a game they have open, or watches it
export type MiniAppRole = "player" | "spectator";

// A game's card as the service shows it live
export type MiniAppLiveCard = {
    status: "open" | "active" | "finished";
    // who's playing now: while a game's taking players, who's joined is only known live
    players: string[];
    // the players whose turn it is
    waitingFor: string[];
    // how many have the game open who aren't playing
    watching: number;
    result: string | undefined;
    // whether the user is a member of the game's chat, who may join it, rather than only watch it
    member: boolean;
};

// Why the service refused a request
export type MiniAppRefusal =
    | "invalid_token"
    | "wrong_chat"
    | "not_member"
    | "unknown_game"
    | "not_open"
    | "full"
    | "refused_by_bot"
    | "bot_unavailable"
    | "no_spectators"
    | "not_a_player"
    | "unavailable";

// A game's state, which the service relays to everyone with the game open: what everyone sees, and
// the user's own part if they're playing. Both are the bot's own JSON, passed to its app as they are.
export type MiniAppState = {
    seq: number;
    shared: unknown;
    private: unknown;
};

export type MiniAppOutcome = { kind: "success" } | { kind: "failed"; message: ResourceKey };

export type MiniAppOpenOutcome =
    | { kind: "opened"; role: MiniAppRole; playerToken: string | undefined }
    | { kind: "failed"; message: ResourceKey };

// A bot refusing to start its game gives its own reason, eg. "Needs 2 players", which goes to its app
export type MiniAppStartOutcome =
    | { kind: "started" }
    | { kind: "refused_by_bot"; message: string | undefined }
    | { kind: "failed"; message: ResourceKey };
