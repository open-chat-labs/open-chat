import {
    createParamInstancesFromSchema,
    paramInstanceIsValid,
    type Bot,
    type BotCommandInstance,
    type FlattenedCommand,
    type MessageContext,
    type MessageFormatter,
    type SlashCommandParam,
    type SlashCommandParamInstance,
} from "openchat-client";
import { derived, get, writable } from "svelte/store";
import { _ } from "svelte-i18n";

function filterCommand(
    formatter: MessageFormatter,
    c: FlattenedCommand,
    selectedCommand: FlattenedCommand | undefined,
    parsedPrefix: string,
    prefixParts: string[],
): boolean {
    if (c.devmode && process.env.NODE_ENV === "production") return false;

    if (selectedCommand !== undefined) {
        return commandsMatch(selectedCommand, c);
    }

    if (prefixParts.length > 1) {
        return c.name.toLocaleLowerCase() === parsedPrefix.toLocaleLowerCase();
    } else {
        const desc = c.description ? formatter(c.description).toLocaleLowerCase() : undefined;
        return (
            c.name.toLocaleLowerCase().includes(parsedPrefix.toLocaleLowerCase()) ||
            (desc?.includes(parsedPrefix.toLocaleLowerCase()) ?? false)
        );
    }
}

function parseCommand(input: string): string[] {
    const regex = /"([^"]+)"|(\S+)/g;
    const result: string[] = [];
    let match;
    while ((match = regex.exec(input)) !== null) {
        if (match[1]) {
            result.push(match[1]);
        } else if (match[2]) {
            result.push(match[2]);
        }
    }
    return result;
}

export const error = writable<string | undefined>(undefined);
export const prefix = writable<string>("");
export const selectedCommand = writable<FlattenedCommand | undefined>(undefined);
export const focusedCommandIndex = writable(0);
export const selectedCommandParamInstances = writable<SlashCommandParamInstance[]>([]);
export const showingBuilder = writable(false);
export const bots = writable<Bot[]>([]);

export const prefixParts = derived(prefix, (prefix) => parseCommand(prefix));
export const maybeParams = derived(prefixParts, (prefixParts) => prefixParts.slice(1) ?? []);
export const parsedPrefix = derived(
    prefixParts,
    (prefixParts) => prefixParts[0]?.slice(1)?.toLocaleLowerCase() ?? "",
);
export const commands = derived(
    [_, bots, selectedCommand, parsedPrefix, prefixParts],
    ([$_, bots, selectedCommand, parsedPrefix, prefixParts]) => {
        return bots.flatMap((b) => {
            switch (b.kind) {
                case "external_bot":
                    return b.commands
                        .map((c) => {
                            return {
                                ...c,
                                kind: b.kind,
                                botName: b.name,
                                botIcon: b.icon,
                                botId: b.id,
                                botEndpoint: b.endpoint,
                                botDescription: b.description,
                            };
                        })
                        .filter((c) =>
                            filterCommand($_, c, selectedCommand, parsedPrefix, prefixParts),
                        ) as FlattenedCommand[];
                case "internal_bot":
                    return b.commands
                        .map((c) => {
                            return {
                                ...c,
                                kind: b.kind,
                                botName: b.name,
                                botDescription: b.description,
                            };
                        })
                        .filter((c) =>
                            filterCommand($_, c, selectedCommand, parsedPrefix, prefixParts),
                        ) as FlattenedCommand[];
            }
        });
    },
);
export const instanceValid = derived(
    [selectedCommand, selectedCommandParamInstances],
    ([selectedCommand, selectedCommandParamInstances]) => {
        if (selectedCommand === undefined) return false;
        if (selectedCommandParamInstances.length !== selectedCommand.params.length) {
            return false;
        }
        const pairs: [SlashCommandParam, SlashCommandParamInstance][] = selectedCommand.params.map(
            (p, i) => [p, selectedCommandParamInstances[i]],
        );
        return pairs.every(([p, i]) => paramInstanceIsValid(p, i));
    },
);

function commandsMatch(a: FlattenedCommand | undefined, b: FlattenedCommand | undefined): boolean {
    if (a === undefined || b === undefined) return false;
    return a.botName === b.botName && a.name === b.name;
}

export function focusPreviousCommand() {
    focusedCommandIndex.update((idx) => {
        return (idx + 1) % get(commands).length;
    });
}
export function focusNextCommand() {
    focusedCommandIndex.update((idx) => {
        const cmds = get(commands);
        return (idx - 1 + cmds.length) % cmds.length;
    });
}

export function createBotInstance(
    command: FlattenedCommand,
    context: MessageContext,
): BotCommandInstance {
    switch (command.kind) {
        case "external_bot":
            return {
                kind: "external_bot",
                id: command.botId,
                endpoint: command.botEndpoint,
                command: {
                    name: command.name,
                    messageContext: context,
                    params: get(selectedCommandParamInstances),
                },
            };
        case "internal_bot":
            return {
                kind: "internal_bot",
                command: {
                    name: command.name,
                    messageContext: context,
                    params: get(selectedCommandParamInstances),
                },
            };
    }
}

export function setSelectedCommand(cmd?: FlattenedCommand) {
    cmd = cmd ?? get(commands)[get(focusedCommandIndex)];

    // make sure that we don't set the same command twice
    if (!commandsMatch(get(selectedCommand), cmd)) {
        selectedCommand.set(cmd);
        if (cmd !== undefined) {
            focusedCommandIndex.set(0);
            if (cmd.params.length > 0) {
                selectedCommandParamInstances.set(
                    createParamInstancesFromSchema(cmd.params, get(maybeParams)),
                );
            }
            // if the instance is not already valid (via inline params) show the builder modal
            showingBuilder.set(!get(instanceValid));
        }
    }
    return selectedCommand;
}

export function cancel() {
    selectedCommand.set(undefined);
    error.set(undefined);
    prefix.set("");
    focusedCommandIndex.set(0);
    selectedCommandParamInstances.set([]);
    showingBuilder.set(false);
}
