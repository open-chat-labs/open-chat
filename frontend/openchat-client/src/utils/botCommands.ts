import {
    hasEveryRequiredPermission,
    i18nKey,
    type ChatIdentifier,
    type ChatPermissions,
    type ChatSummary,
    type FlattenedCommand,
    type GrantedBotPermissions,
    type MessagePermission,
    type ReadonlyMap,
    type ResourceKey,
} from "@shared";
import { userMessagePermissionFor } from "./botMessagePermissions";
import { isPermitted } from "./permissions";

/** Where a bot command would run, as `commandsAvailable` weighs it. */
export type CommandPlace = {
    /** The kind of chat it would run in (a thread's is its chat's). */
    chatKind: ChatIdentifier["kind"];
    /** That chat (none while it isn't known). */
    chat: ChatSummary | undefined;
    /** In a direct chat with a bot, that bot: only its commands, and the built-in ones it takes. */
    directBotId: string | undefined;
    /** What the reader may send there: the chat's message permissions, or its thread's. */
    permitted: ReadonlySet<MessagePermission>;
    /** The bots installed there (a channel's are its community's), with what each was granted. */
    installedBots: ReadonlyMap<string, GrantedBotPermissions>;
};

// the chat permissions a command may ask for that every member has
const READ_PERMISSIONS: string[] = ["readMessages", "readMembership", "readChatSummary"];

/**
 * The commands the reader may run here, as both old command selectors offer them: in a direct chat
 * with a bot only that bot's (and the built-in ones it takes), none a direct chat takes no part
 * in, and only those the reader's role, the chat's permissions and what the reader may send
 * allow, an installed bot's only once it was granted every permission the command needs.
 */
export function commandsAvailable(
    commands: FlattenedCommand[],
    place: CommandPlace,
): FlattenedCommand[] {
    return commands.filter(
        (c) =>
            forThisBot(c, place.directBotId) && forThisChat(c, place.chatKind) && allowed(c, place),
    );
}

function forThisBot(command: FlattenedCommand, directBotId: string | undefined): boolean {
    return (
        directBotId === undefined ||
        (command.kind === "external_bot" && command.botId === directBotId) ||
        (command.kind === "internal_bot" && command.directBotDisabled === false)
    );
}

function forThisChat(command: FlattenedCommand, chatKind: ChatIdentifier["kind"]): boolean {
    return !(chatKind === "direct_chat" && command.directChatsDisabled === true);
}

function readerMayRun(command: FlattenedCommand, place: CommandPlace): boolean {
    const chat = place.chat;
    const group = chat !== undefined && chat.kind !== "direct_chat" ? chat : undefined;
    const roleAllows =
        group === undefined || isPermitted(group.membership.role, command.defaultRole);
    const chatAllows =
        group === undefined ||
        command.permissions.chatPermissions.every((p) => {
            if (READ_PERMISSIONS.includes(p)) return true;
            const role = group.permissions[p as keyof ChatPermissions];
            return typeof role === "number" && isPermitted(group.membership.role, role);
        });
    return (
        roleAllows &&
        chatAllows &&
        command.permissions.messagePermissions.every((p) => {
            const needed = userMessagePermissionFor(p);
            return needed !== undefined && place.permitted.has(needed);
        })
    );
}

function allowed(command: FlattenedCommand, place: CommandPlace): boolean {
    if (!readerMayRun(command, place)) return false;
    if (command.kind === "internal_bot") return true;
    // an installed bot's command needs every permission it asks for granted to the bot
    const granted = place.installedBots.get(command.botId);
    return (
        granted !== undefined && hasEveryRequiredPermission(command.permissions, granted.command)
    );
}

/** How running a bot command went (`executeBotCommand`). */
export type BotCommandResult = "success" | "failure" | "too_many_requests";

/** What the reader is told when a bot command fails, as the old trees word it; none once it ran. */
export function botCommandFailure(result: BotCommandResult): ResourceKey | undefined {
    switch (result) {
        case "success":
            return undefined;
        case "failure":
            return i18nKey("bots.failed");
        case "too_many_requests":
            return i18nKey("bots.tooManyRequests");
    }
}
