import {
    argIsValid,
    createArgsFromSchema,
    type BotCommandInstance,
    type CommandArg,
    type CommandParam,
    type ExternalBot,
    type FlattenedCommand,
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

function sortByPrefix(prefix: string): (a: FlattenedCommand, b: FlattenedCommand) => number {
    return (a, b) => {
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

export class BotState {
    #messageFormatter = $state<MessageFormatter>((s) => s);
    #error = $state<string | undefined>();
    #prefix = $state<string>("");
    #selectedCommand = $state<FlattenedCommand | undefined>();
    #focusedCommandIndex = $state(0);
    #selectedCommandArgs = $state<CommandArg[]>([]);
    #externalBots = $state<Map<string, ExternalBot>>(new Map());
    #showingBuilder = $state<boolean>(false);
    #prefixParts = $derived(parseCommand(this.#prefix));
    #maybeArgs = $derived(this.#prefixParts.slice(1) ?? []);
    #parsedPrefix = $derived(this.#prefixParts[0]?.slice(1)?.toLocaleLowerCase() ?? "");
    #commands = $derived.by(() => {
        const bots = [builtinBot, ...this.#externalBots.values()];
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
                                filterCommand(
                                    this.#messageFormatter,
                                    c,
                                    this.#selectedCommand,
                                    this.#parsedPrefix,
                                    this.#prefixParts,
                                ),
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
                                filterCommand(
                                    this.#messageFormatter,
                                    c,
                                    this.#selectedCommand,
                                    this.#parsedPrefix,
                                    this.#prefixParts,
                                ),
                            ) as FlattenedCommand[];
                }
            })
            .sort(sortByPrefix(this.#parsedPrefix));
    });
    #instanceValid = $derived.by(() => {
        if (this.#selectedCommand === undefined) return false;
        return this.instanceIsValid(this.#selectedCommand, this.#selectedCommandArgs);
    });

    public set messageFormatter(v: MessageFormatter) {
        this.#messageFormatter = v;
    }

    public get focusedCommandIndex() {
        return this.#focusedCommandIndex;
    }

    public get instanceValid() {
        return this.#instanceValid;
    }

    public get showingBuilder(): boolean {
        return this.#showingBuilder;
    }

    public get error(): string | undefined {
        return this.#error;
    }

    public set error(err: string | undefined) {
        this.#error = err;
    }

    public get commands(): FlattenedCommand[] {
        return this.#commands;
    }

    public get selectedCommand() {
        return this.#selectedCommand;
    }

    public get selectedCommandArgs() {
        return this.#selectedCommandArgs;
    }

    public get prefix() {
        return this.#prefix;
    }

    public set prefix(v: string) {
        this.#prefix = v;
    }

    focusPreviousCommand() {
        this.#focusedCommandIndex = (this.#focusedCommandIndex + 1) % this.#commands.length;
    }

    focusNextCommand() {
        this.#focusedCommandIndex =
            (this.#focusedCommandIndex - 1 + this.#commands.length) % this.#commands.length;
    }

    setSelectedCommand(commands: FlattenedCommand[], cmd?: FlattenedCommand) {
        cmd = cmd ?? commands[this.#focusedCommandIndex];

        // make sure that we don't set the same command twice
        if (!commandsMatch(this.#selectedCommand, cmd)) {
            this.#selectedCommand = cmd;
            if (cmd !== undefined) {
                this.#focusedCommandIndex = 0;
                if (cmd.params.length > 0) {
                    this.#selectedCommandArgs = createArgsFromSchema(cmd.params, this.#maybeArgs);
                }
                // if the instance is not already valid (via inline params) show the builder modal
                this.#showingBuilder = !this.#instanceValid;
            }
        }
        return this.#selectedCommand;
    }

    cancel() {
        this.#selectedCommand = undefined;
        this.#error = undefined;
        this.#prefix = "";
        this.#focusedCommandIndex = 0;
        this.#selectedCommandArgs = [];
        this.#showingBuilder = false;
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
                        arguments: this.#selectedCommandArgs,
                        placeholder: command.placeholder,
                    },
                };
            case "internal_bot":
                return {
                    kind: "internal_bot",
                    command: {
                        name: command.name,
                        arguments: this.#selectedCommandArgs,
                    },
                };
        }
    }

    instanceIsValid(command: FlattenedCommand, params: CommandArg[]): boolean {
        if (params.length !== command.params.length) {
            return false;
        }
        const pairs: [CommandParam, CommandArg][] = command.params.map((p, i) => [p, params[i]]);
        return pairs.every(([p, i]) => argIsValid(p, i));
    }

    public get externalBots() {
        return this.#externalBots;
    }

    setExternalBots(bots: ExternalBot[]) {
        const map = new Map<string, ExternalBot>();
        bots.forEach((b) => map.set(b.id, b));
        this.#externalBots = map;
    }
}

export const botState = new BotState();
