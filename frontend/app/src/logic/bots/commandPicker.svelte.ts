import {
    BotState,
    botState as appBotState,
    commandsAvailable,
    loadDateParser,
    random64,
    shownParams,
    type BotCommandResult,
    type CommandArg,
    type CommandParam,
    type CommandPlace,
    type FlattenedCommand,
    type MessageContext,
    type OpenChat,
} from "@client";
import { dateAwareSelection } from "@src/utils/commandSelection";

// A bot command typed in the composer, as both old trees run one: the "/" at the start of the draft
// lists the commands the reader may run here (`commandsAvailable`), matched to what's typed
// (`BotState`, the client's: by name or description, or by name once arguments follow); a pick
// takes the arguments typed after its name (a date typed in words once the date parser is in,
// `dateAwareSelection`) and runs it when they're all there, else asks for them in a form, from
// which it runs.

/** What became of a command picked. */
export type CommandPick =
    // it's running: `result` settles with how that went
    | { kind: "sent"; result: Promise<BotCommandResult> }
    // it needs arguments typed after its name aren't enough for: the form (`form`, `args`,
    // `shown`) is open for them, and `sent` settles with whether it went from there
    | { kind: "needs_args"; command: FlattenedCommand; sent: Promise<boolean> }
    // another pick, or leaving, overtook it
    | { kind: "gone" };

/** The command whose arguments the form asks for, and the chat or thread it runs in. */
export type CommandForm = { context: MessageContext; command: FlattenedCommand };

/**
 * The one command being picked or filled in, per composer. A chat's and a thread's composers each
 * type and pick their own, so each picker keeps its own `BotState`, going by the app's bots.
 */
export class CommandPicker {
    readonly #bots: BotState;
    readonly #loadParser: () => Promise<void>;
    // whether a "/" is being typed
    #typing = $state(false);
    #form = $state<(CommandForm & { done: (sent: boolean) => void }) | undefined>();
    #pending: ((pick: CommandPick) => void) | undefined;
    #picked: { context: MessageContext; commands: FlattenedCommand[] } | undefined;
    #selection: ReturnType<typeof dateAwareSelection<FlattenedCommand>>;

    constructor(
        private readonly client: Pick<OpenChat, "executeBotCommand">,
        bots: BotState = appBotState,
        loadParser: () => Promise<void> = loadDateParser,
    ) {
        this.#bots = new BotState(bots);
        this.#loadParser = loadParser;
        this.#selection = dateAwareSelection<FlattenedCommand>(
            (command) => this.#selected(command),
            loadParser,
        );
    }

    /**
     * The draft's first line while it starts with "/" (the command being typed, and any arguments
     * after it), or undefined once it doesn't, or the composer's gone (another chat's opened):
     * that drops what's being picked or filled in, closing the form, not sent.
     */
    typed(text: string | undefined): void {
        if (text === undefined) {
            this.cancel();
            return;
        }
        if (!this.#typing) {
            // on its way by the time a command is picked, as the old selector had it
            void this.#loadParser();
        }
        this.#typing = true;
        this.#bots.prefix = text;
    }

    /**
     * The commands offered for what's typed: those the reader may run here, and of the built-in
     * ones only those this tree can carry out (`handles`).
     */
    offered(
        place: CommandPlace,
        handles: (command: FlattenedCommand) => boolean,
    ): FlattenedCommand[] {
        if (!this.#typing) return [];
        return commandsAvailable(this.#bots.commands, place).filter(
            (c) => c.kind === "external_bot" || handles(c),
        );
    }

    /** Picks a command offered (`commands`): it runs, or needs its arguments asked for. */
    pick(
        context: MessageContext,
        commands: FlattenedCommand[],
        command: FlattenedCommand,
    ): Promise<CommandPick> {
        this.#settle({ kind: "gone" });
        this.#closeForm(false);
        return new Promise((resolve) => {
            this.#pending = resolve;
            this.#picked = { context, commands };
            this.#selection.select(command);
        });
    }

    #selected(command: FlattenedCommand): void {
        const picked = this.#picked;
        if (picked === undefined) return;
        this.#bots.setSelectedCommand(picked.context, picked.commands, command);
        const selected = this.#bots.selectedCommand;
        if (selected === undefined) {
            this.#settle({ kind: "gone" });
        } else if (this.#bots.instanceValid) {
            this.#settle({ kind: "sent", result: this.#run(picked.context, selected) });
        } else {
            const sent = new Promise<boolean>((done) => {
                this.#form = { context: picked.context, command: selected, done };
            });
            this.#settle({ kind: "needs_args", command: selected, sent });
        }
    }

    #settle(pick: CommandPick): void {
        const pending = this.#pending;
        this.#pending = undefined;
        pending?.(pick);
    }

    #closeForm(sent: boolean): void {
        const form = this.#form;
        this.#form = undefined;
        form?.done(sent);
    }

    /** The command whose arguments the form asks for, while it's open. */
    get form(): CommandForm | undefined {
        const form = this.#form;
        return form === undefined ? undefined : { context: form.context, command: form.command };
    }

    /** The arguments of the command being filled in, a value per parameter. */
    get args(): CommandArg[] {
        return this.#bots.selectedCommandArgs;
    }

    /** The parameters the form shows for them (undefined for a hidden one), as `shownParams` has it. */
    get shown(): (CommandParam | undefined)[] {
        const command = this.#bots.selectedCommand;
        return command === undefined
            ? []
            : shownParams(command.params, this.#bots.selectedCommandArgs);
    }

    /** Whether the form's arguments are enough to run it. */
    get valid(): boolean {
        return this.#bots.instanceValid;
    }

    /** A parameter's argument changed in the form. */
    setArg(index: number, arg: CommandArg): void {
        this.#bots.selectedCommandArgs[index] = arg;
    }

    /** Runs the command being filled in, if its arguments are enough; the form closes, sent. */
    submit(context: MessageContext): Promise<BotCommandResult> | undefined {
        const command = this.#bots.selectedCommand;
        if (command === undefined || !this.#bots.instanceValid) return undefined;
        const result = this.#run(context, command);
        this.#closeForm(true);
        return result;
    }

    /** Drops what's being picked or filled in; an open form closes, not sent. */
    cancel(): void {
        this.#selection.stop();
        this.#settle({ kind: "gone" });
        this.#closeForm(false);
        this.#reset();
    }

    #reset(): void {
        this.#picked = undefined;
        this.#bots.cancel();
        this.#typing = false;
    }

    // runs it in the chat or thread it was picked in, and the picking's over
    #run(context: MessageContext, command: FlattenedCommand): Promise<BotCommandResult> {
        const instance = this.#bots.createBotInstance(command);
        this.#reset();
        return this.client.executeBotCommand(
            {
                kind: "chat_scope",
                chatId: context.chatId,
                threadRootMessageIndex: context.threadRootMessageIndex,
                messageId: random64(),
            },
            instance,
        );
    }
}
