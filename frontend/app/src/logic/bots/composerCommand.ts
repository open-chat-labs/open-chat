import type { FlattenedCommand } from "@client";
import type { ComposerCommand } from "@openchat/ui/src/lib/types";

/** The same while it's the same command of the same bot. */
export function commandKey(command: FlattenedCommand): string {
    return command.kind === "external_bot"
        ? `${command.botId}/${command.name}`
        : `openchat/${command.name}`;
}

/**
 * A command as the composer's command list shows it: its name, what it does, its parameters (the
 * required ones marked) and its bot, as the old selectors do; the built-in bot's names and
 * descriptions are resource keys, a bot's own are text (`text` gives a key's words, and other
 * text as it is).
 */
export function composerCommand(
    command: FlattenedCommand,
    text: (keyOrText: string) => string,
): ComposerCommand {
    return {
        key: commandKey(command),
        name: command.name,
        description:
            command.description === undefined || command.description === ""
                ? undefined
                : text(command.description),
        botName: text(command.botName),
        avatar: command.kind === "external_bot" ? command.avatarUrl : undefined,
        params: command.params.map((p) => ({ name: text(p.name), required: p.required })),
    };
}
