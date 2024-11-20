import type { ExternalBot, FlattenedCommand, SlashCommandParamInstance } from "openchat-client";
import { getBots } from "./testBots";

let error = $state<string | undefined>(undefined);
let prefix = $state<string>("");
let parsedPrefix = $derived(prefix.slice(1).toLocaleLowerCase());
let bots = $state<ExternalBot[]>([]);
let commands = $derived.by(() => {
    return botState.bots.flatMap((b) => {
        return b.commands
            .map((c) => ({
                ...c,
                botName: b.name,
                botIcon: b.icon,
                botDescription: b.description,
            }))
            .filter((c) => {
                return (
                    c.name.toLocaleLowerCase().includes(parsedPrefix) ||
                    c.description?.toLocaleLowerCase()?.includes(parsedPrefix)
                );
            });
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
    set bots(val: ExternalBot[]) {
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
}

export const botState = new BotState();
