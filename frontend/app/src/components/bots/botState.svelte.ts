import {
    createParamInstancesFromSchema,
    paramInstanceIsValid,
    type Bot,
    type BotCommandInstance,
    type FlattenedCommand,
    type MessageContext,
    type SlashCommandParam,
    type SlashCommandParamInstance,
} from "openchat-client";
import { getBots } from "./testBots";

function filterCommand(c: FlattenedCommand): boolean {
    if (c.devmode && process.env.NODE_ENV === "production") return false;

    if (prefixParts.length > 1) {
        return c.name.toLocaleLowerCase() === parsedPrefix.toLocaleLowerCase();
    } else {
        return (
            c.name.toLocaleLowerCase().includes(parsedPrefix.toLocaleLowerCase()) ||
            (c.description?.toLocaleLowerCase()?.includes(parsedPrefix.toLocaleLowerCase()) ??
                false)
        );
    }
}

let error = $state<string | undefined>(undefined);
let prefix = $state<string>("");
let prefixParts = $derived(prefix.split(" "));
let maybeParams = $derived(prefixParts.slice(1));
let parsedPrefix = $derived(prefixParts[0].slice(1).toLocaleLowerCase());
let bots = $state<Bot[]>([]);
let commands = $derived.by(() => {
    return botState.bots.flatMap((b) => {
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
                    .filter(filterCommand) as FlattenedCommand[];
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
                    .filter(filterCommand) as FlattenedCommand[];
        }
    });
});
let selectedCommand = $state<FlattenedCommand | undefined>(undefined);
let focusedCommandIndex = $state(0);
let focusedParamIndex = $state(0);
let focusedParam = $derived(selectedCommand?.params?.[focusedParamIndex]);
let selectedCommandParamInstances = $state<SlashCommandParamInstance[]>([]);
let focusedParamInstance = $derived(selectedCommandParamInstances[focusedParamIndex]);
let instanceValid = $derived.by(() => {
    if (selectedCommand === undefined) return false;
    if (selectedCommandParamInstances.length !== selectedCommand.params.length) {
        return false;
    }
    const pairs: [SlashCommandParam, SlashCommandParamInstance][] = selectedCommand.params.map(
        (p, i) => [p, botState.selectedCommandParamInstances[i]],
    );
    return pairs.every(([p, i]) => paramInstanceIsValid(p, i));
});
let showingBuilder = $derived(selectedCommand !== undefined && !instanceValid);

function commandsMatch(a: FlattenedCommand | undefined, b: FlattenedCommand | undefined): boolean {
    if (a === undefined || b === undefined) return false;
    return a.botName === b.botName && a.name === b.name;
}

class BotState {
    constructor() {
        getBots().then((b) => (this.bots = b));
    }
    get bots() {
        return bots;
    }
    set bots(val: Bot[]) {
        bots = val;
    }
    get showingBuilder() {
        return showingBuilder;
    }
    get instanceValid() {
        return instanceValid;
    }
    set prefix(val: string) {
        prefix = val;
    }
    set selectedCommandParamInstances(val: SlashCommandParamInstance[]) {
        selectedCommandParamInstances = val;
    }
    get selectedCommandParamInstances() {
        return selectedCommandParamInstances;
    }
    get focusedParamInstance() {
        return focusedParamInstance;
    }
    focusPreviousCommand() {
        focusedCommandIndex = (focusedCommandIndex + 1) % commands.length;
    }
    focusNextCommand() {
        focusedCommandIndex = (focusedCommandIndex - 1 + commands.length) % commands.length;
    }
    selectCommand(val: FlattenedCommand) {
        selectedCommand = $state.snapshot(val);
        prefix = `/${val.name}`;
    }
    get focusedCommandIndex() {
        return focusedCommandIndex;
    }
    set focusedCommandIndex(val: number) {
        focusedCommandIndex = val;
    }
    get commands() {
        return commands;
    }
    get focusedParamIndex() {
        return focusedParamIndex;
    }
    set focusedParamIndex(val: number) {
        focusedParamIndex = val;
    }
    get focusedParam() {
        return focusedParam;
    }
    cancel() {
        selectedCommand = undefined;
        error = undefined;
        prefix = "";
        focusedCommandIndex = 0;
        focusedParamIndex = 0;
        selectedCommandParamInstances = [];
    }
    setSelectedCommand() {
        const cmd = commands[focusedCommandIndex];

        // make sure that we don't set the same command twice
        if (!commandsMatch(selectedCommand, cmd)) {
            selectedCommand = cmd;
            if (selectedCommand !== undefined) {
                if (selectedCommand.params.length > 0) {
                    this.selectedCommandParamInstances = createParamInstancesFromSchema(
                        selectedCommand.params,
                        maybeParams,
                    );
                }
            }
        }
        return selectedCommand;
    }
    get selectedCommand(): FlattenedCommand | undefined {
        return selectedCommand;
    }
    set selectedCommand(val: FlattenedCommand | undefined) {
        focusedParamIndex = 0;
        selectedCommand = val;
        focusedCommandIndex = 0;
        if (val) {
            prefix = `/${val.name}`;
        }
    }
    get error() {
        return error;
    }
    set error(val: string | undefined) {
        error = val;
    }
    createBotInstance(command: FlattenedCommand, context: MessageContext): BotCommandInstance {
        switch (command.kind) {
            case "external_bot":
                return {
                    kind: "external_bot",
                    id: command.botId,
                    endpoint: command.botEndpoint,
                    command: {
                        name: command.name,
                        messageContext: context,
                        params: selectedCommandParamInstances,
                    },
                };
            case "internal_bot":
                return {
                    kind: "internal_bot",
                    command: {
                        name: command.name,
                        messageContext: context,
                        params: selectedCommandParamInstances,
                    },
                };
        }
    }
}

export const botState = new BotState();
