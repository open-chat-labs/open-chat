import type {
    Bot,
    BotCommandInstance,
    FlattenedCommand,
    SlashCommandParamInstance,
} from "openchat-client";
import { getBots } from "./testBots";

function filterCommand(c: FlattenedCommand): boolean {
    return (
        c.name.toLocaleLowerCase().includes(parsedPrefix) ||
        (c.description?.toLocaleLowerCase()?.includes(parsedPrefix) ?? false)
    );
}

let error = $state<string | undefined>(undefined);
let prefix = $state<string>("");
let parsedPrefix = $derived(prefix.slice(1).toLocaleLowerCase());
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
        this.selectedCommand = commands[focusedCommandIndex];
        return this.selectedCommand;
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
    createBotInstance(command: FlattenedCommand): BotCommandInstance {
        switch (command.kind) {
            case "external_bot":
                return {
                    kind: "external_bot",
                    id: command.botId,
                    endpoint: command.botEndpoint,
                    command: {
                        name: command.name,
                        params: selectedCommandParamInstances,
                    },
                };
            case "internal_bot":
                return {
                    kind: "internal_bot",
                    command: {
                        name: command.name,
                        params: selectedCommandParamInstances,
                    },
                };
        }
    }
}

export const botState = new BotState();
