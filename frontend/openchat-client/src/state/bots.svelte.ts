import {
    argIsValid,
    createArgsFromSchema,
    type BotCommandInstance,
    type CommandArg,
    type CommandParam,
    type ExternalBot,
    type FlattenedCommand,
    type MessageContext,
    type MessageFormatter,
} from "openchat-shared";
import { builtinBot } from "../utils/builtinBotCommands";

function filterCommand(
    formatter: MessageFormatter,
    c: FlattenedCommand,
    selectedCommand: FlattenedCommand | undefined,
    parsedPrefix: string,
    prefixParts: string[],
): boolean {
    if (c.devmode && import.meta.env.OC_NODE_ENV === "production") return false;

    if (selectedCommand !== undefined) {
        return commandsMatch(selectedCommand, c);
    }

    if (prefixParts.length > 1) {
        return c.name.toLocaleLowerCase() === parsedPrefix;
    } else {
        const desc = c.description ? formatter(c.description).toLocaleLowerCase() : undefined;
        return (
            c.name.toLocaleLowerCase().includes(parsedPrefix) ||
            (desc?.includes(parsedPrefix) ?? false)
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

function sortCommands(prefix: string): (a: FlattenedCommand, b: FlattenedCommand) => number {
    return (a, b) => {
        if (prefix.length === 0) {
            const compareBotNames = a.botName.localeCompare(b.botName);
            if (compareBotNames !== 0) {
                return compareBotNames;
            }
        }

        const aStartsWithPrefix = a.name.toLocaleLowerCase().startsWith(prefix);
        const bStartsWithPrefix = b.name.toLocaleLowerCase().startsWith(prefix);

        if (aStartsWithPrefix && !bStartsWithPrefix) {
            return -1;
        } else if (!aStartsWithPrefix && bStartsWithPrefix) {
            return 1;
        } else {
            return a.name.localeCompare(b.name);
        }
    };
}

function commandsMatch(a: FlattenedCommand | undefined, b: FlattenedCommand | undefined): boolean {
    if (a === undefined || b === undefined) return false;
    return a.botName === b.botName && a.name === b.name;
}
let messageFormatter = $state<MessageFormatter>((s) => s);
let error = $state<string | undefined>();
let prefix = $state<string>("");
let selectedCommand = $state<FlattenedCommand | undefined>();
let focusedCommandIndex = $state(0);
let selectedCommandArgs = $state<CommandArg[]>([]);
let externalBots = $state<Map<string, ExternalBot>>(new Map());
let showingBuilder = $state<MessageContext | undefined>();
const prefixParts = $derived(parseCommand(prefix));
const maybeArgs = $derived(prefixParts.slice(1) ?? []);
const parsedPrefix = $derived(prefixParts[0]?.slice(1)?.toLocaleLowerCase() ?? "");
const commands = $derived.by(() => {
    const parts = prefixParts;
    const prefix = parsedPrefix;
    const bots = [builtinBot, ...externalBots.values()];
    return bots
        .flatMap((b) => {
            switch (b.kind) {
                case "external_bot":
                    return b.definition.commands
                        .map((c) => {
                            return {
                                ...c,
                                kind: b.kind,
                                botName: b.name,
                                avatarUrl: b.avatarUrl,
                                botId: b.id,
                                botEndpoint: b.endpoint,
                                botDescription: b.definition.description,
                            };
                        })
                        .filter((c) =>
                            filterCommand(messageFormatter, c, selectedCommand, prefix, parts),
                        ) as FlattenedCommand[];
                case "internal_bot":
                    return b.definition.commands
                        .map((c) => {
                            return {
                                ...c,
                                kind: b.kind,
                                botName: b.name,
                                botDescription: b.definition.description,
                            };
                        })
                        .filter((c) =>
                            filterCommand(messageFormatter, c, selectedCommand, prefix, parts),
                        ) as FlattenedCommand[];
            }
        })
        .sort(sortCommands(parsedPrefix));
});
const instanceValid = $derived.by(() => {
    if (selectedCommand === undefined) return false;
    return instanceIsValid(selectedCommand, selectedCommandArgs);
});

export function instanceIsValid(command: FlattenedCommand, params: CommandArg[]): boolean {
    if (params.length !== command.params.length) {
        return false;
    }
    const pairs: [CommandParam, CommandArg][] = command.params.map((p, i) => [p, params[i]]);
    return pairs.every(([p, i]) => argIsValid(p, i));
}

export class BotState {
    public set messageFormatter(v: MessageFormatter) {
        messageFormatter = v;
    }

    public get focusedCommandIndex() {
        return focusedCommandIndex;
    }

    public get instanceValid() {
        return instanceValid;
    }

    public get showingBuilder(): MessageContext | undefined {
        return showingBuilder;
    }

    public get error(): string | undefined {
        return error;
    }

    public set error(err: string | undefined) {
        error = err;
    }

    public get commands(): FlattenedCommand[] {
        return commands;
    }

    public get selectedCommand() {
        return selectedCommand;
    }

    public get selectedCommandArgs() {
        return selectedCommandArgs;
    }

    public get prefix() {
        return prefix;
    }

    public set prefix(v: string) {
        prefix = v;
    }

    public get prefixParts() {
        return prefixParts;
    }

    public get parsedPrefix() {
        return parsedPrefix;
    }

    focusPreviousCommand() {
        focusedCommandIndex = (focusedCommandIndex + 1) % commands.length;
    }

    focusNextCommand() {
        focusedCommandIndex = (focusedCommandIndex - 1 + commands.length) % commands.length;
    }

    setSelectedCommand(
        messageContext: MessageContext,
        commands: FlattenedCommand[],
        cmd?: FlattenedCommand,
    ) {
        cmd = cmd ?? commands[focusedCommandIndex];

        // make sure that we don't set the same command twice
        if (!commandsMatch(selectedCommand, cmd)) {
            selectedCommand = cmd;
            if (cmd !== undefined) {
                focusedCommandIndex = 0;
                if (cmd.params.length > 0) {
                    selectedCommandArgs = createArgsFromSchema(cmd.params, maybeArgs);
                }
                // if the instance is not already valid (via inline params) show the builder modal
                showingBuilder = !instanceValid ? messageContext : undefined;
            }
        }
        return selectedCommand;
    }

    cancel() {
        selectedCommand = undefined;
        error = undefined;
        prefix = "";
        focusedCommandIndex = 0;
        selectedCommandArgs = [];
        showingBuilder = undefined;
    }

    createBotInstance(command: FlattenedCommand): BotCommandInstance {
        switch (command.kind) {
            case "external_bot":
                return {
                    kind: "external_bot",
                    id: command.botId,
                    endpoint: command.botEndpoint,
                    command: {
                        name: command.name,
                        arguments: selectedCommandArgs,
                        placeholder: command.placeholder,
                    },
                };
            case "internal_bot":
                return {
                    kind: "internal_bot",
                    command: {
                        name: command.name,
                        arguments: selectedCommandArgs,
                    },
                };
        }
    }

    public get externalBots() {
        return externalBots;
    }

    setExternalBots(bots: ExternalBot[]) {
        const map = new Map<string, ExternalBot>();
        bots.forEach((b) => map.set(b.id, b));
        externalBots = map;
    }
}

export const botState = new BotState();
