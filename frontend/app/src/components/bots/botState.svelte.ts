import type { ExternalBot, FlattenedCommand } from "openchat-client";
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
let focusedParamIndex = $state(0);
let focusedParam = $derived(selectedCommand?.params?.[focusedParamIndex]);

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
    setSelectedCommand() {
        const cmd = commands[0];
        if (cmd) {
            prefix = `/${cmd.name}`;
        }
        this.selectedCommand = cmd;
    }
    get selectedCommand(): FlattenedCommand | undefined {
        return selectedCommand;
    }
    set selectedCommand(val: FlattenedCommand | undefined) {
        focusedParamIndex = 0;
        selectedCommand = val;
    }
    get error() {
        return error;
    }
    set error(val: string | undefined) {
        error = val;
    }
}

export const botState = new BotState();
