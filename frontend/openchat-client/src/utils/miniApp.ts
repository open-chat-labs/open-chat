import {
    type BotDefinition,
    chatIdentifierToString,
    i18nKey,
    type MessageContext,
    type MiniAppContent,
    type MiniAppGame,
    type MiniAppLiveCard,
    type MiniAppRefusal,
    type ResourceKey,
} from "@shared";

// The most players a card can have, whatever its own limit
const MAX_PLAYERS = 100;

export function miniAppGameKey({ chatId, threadRootMessageIndex, messageId }: MiniAppGame): string {
    return `${chatIdentifierToString(chatId)}_${threadRootMessageIndex ?? ""}_${messageId}`;
}

// The game played from a MiniApp message. Direct chats have none.
export function miniAppGame(context: MessageContext, messageId: bigint): MiniAppGame | undefined {
    const { chatId, threadRootMessageIndex } = context;
    return chatId.kind === "direct_chat"
        ? undefined
        : { chatId, threadRootMessageIndex, messageId };
}

// What a user can do from a game's card, and around its app once it's open. Each needs the MiniApp
// service, so there's nothing to do from a card the service isn't showing live.
// - join: a member, while the game's taking players and isn't full
// - leave: a player, while the game's taking players
export type MiniAppAction = "join" | "leave";

export type MiniAppCardView = {
    status: "open" | "active" | "finished";
    // as the service shows them live, or else as the card in the chat records them
    players: string[];
    waitingFor: string[];
    // how many are watching, which only the service knows
    watching: number | undefined;
    result: string | undefined;
    // how the game ended, as JSON the bot chose, once the card in the chat records it: the app shows
    // it in the card in place of the game. Only ever from the stored card, as the service forgets a
    // game once it's finished.
    endState: string | undefined;
    yourTurn: boolean;
    // whether the user may have the game's app open, which shows the game in the card: a player
    // may, and so may anyone else if the game allows spectators, until it's finished
    canOpen: boolean;
    // the first is the main one
    actions: MiniAppAction[];
};

// A game's card: the live one if the service is showing it, otherwise the one stored in the chat
export function miniAppCardView(
    content: MiniAppContent,
    live: MiniAppLiveCard | undefined,
    userId: string,
): MiniAppCardView {
    const stored = content.status;
    const status = live?.status ?? stored.kind;
    const players = live?.players ?? (stored.kind === "open" ? [] : stored.players);
    const waitingFor =
        status === "finished"
            ? []
            : (live?.waitingFor ?? (stored.kind === "active" ? stored.waitingFor : []));
    return {
        status,
        players,
        waitingFor,
        // Nobody's watching a finished game, whatever the last live card said
        watching: status === "finished" ? undefined : live?.watching,
        result:
            live !== undefined
                ? live.result
                : stored.kind === "finished"
                  ? stored.result
                  : undefined,
        endState: stored.kind === "finished" ? stored.endState : undefined,
        yourTurn: status === "active" && waitingFor.includes(userId),
        canOpen: status !== "finished" && (players.includes(userId) || content.spectators),
        actions: live === undefined ? [] : miniAppActions(content, live, userId),
    };
}

// The image of the bot's app a card names, from the bot's definition, which the card shows whenever
// there's no app to show. The definition gives it as https, or a path relative to the bot's endpoint,
// eg. "app/chess.svg". Undefined if the bot doesn't declare the app, or the image isn't http(s).
export function miniAppImageUrl(
    definition: BotDefinition,
    app: string,
    endpoint: string,
): string | undefined {
    const imageUrl = definition.miniApps.find((a) => a.name === app)?.imageUrl;
    if (imageUrl === undefined) return undefined;
    try {
        const url = new URL(imageUrl, `${endpoint.replace(/\/+$/, "")}/`);
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
    } catch {
        return undefined;
    }
}

function miniAppActions(
    content: MiniAppContent,
    live: MiniAppLiveCard,
    userId: string,
): MiniAppAction[] {
    if (live.status !== "open") {
        return [];
    }
    if (live.players.includes(userId)) {
        return ["leave"];
    }
    const full = live.players.length >= Math.min(content.maxPlayers ?? MAX_PLAYERS, MAX_PLAYERS);
    return live.member && !full ? ["join"] : [];
}

// Why the service refused a request, or, with no refusal, that it couldn't be reached
export function miniAppFailureMessage(
    refusal: { reason: MiniAppRefusal; message?: string } | undefined,
): ResourceKey {
    if (refusal === undefined) {
        return i18nKey("bots.miniApp.refusals.unreachable");
    }
    switch (refusal.reason) {
        case "refused_by_bot":
            return refusal.message
                ? i18nKey("bots.miniApp.refusals.refusedByBot", { message: refusal.message })
                : i18nKey("bots.miniApp.refusals.refusedByBotNoReason");
        case "invalid_token":
        case "wrong_chat":
            return i18nKey("bots.miniApp.refusals.invalidToken");
        case "not_member":
            return i18nKey("bots.miniApp.refusals.notMember");
        case "unknown_game":
            return i18nKey("bots.miniApp.refusals.unknownGame");
        case "not_open":
            return i18nKey("bots.miniApp.refusals.notOpen");
        case "full":
            return i18nKey("bots.miniApp.refusals.full");
        case "bot_unavailable":
            return i18nKey("bots.miniApp.refusals.botUnavailable");
        case "no_spectators":
            return i18nKey("bots.miniApp.refusals.noSpectators");
        case "not_a_player":
            return i18nKey("bots.miniApp.refusals.notAPlayer");
        case "unavailable":
            return i18nKey("bots.miniApp.refusals.unavailable");
    }
}
