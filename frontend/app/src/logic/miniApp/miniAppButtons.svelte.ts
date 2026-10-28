import type { MessageButton, MessageContext, OpenChat, PressMiniAppButtonOutcome } from "@client";

/**
 * The buttons of one of a bot's MiniApp messages, as someone presses them. One press at a time:
 * pressing another while the bot hasn't answered does nothing. The view shows `failed` outcomes.
 */
export class MiniAppButtons {
    #pending = $state<string | undefined>();

    constructor(
        private readonly client: OpenChat,
        private readonly context: () => {
            messageContext: MessageContext;
            messageId: bigint;
            botId: string;
        },
    ) {}

    // The id of the button whose press the bot hasn't answered yet
    get pending(): string | undefined {
        return this.#pending;
    }

    async press(button: MessageButton): Promise<PressMiniAppButtonOutcome | undefined> {
        if (this.#pending !== undefined) return undefined;
        const { messageContext, messageId, botId } = this.context();
        this.#pending = button.id;
        try {
            return await this.client.pressMiniAppButton(messageContext, messageId, botId, button);
        } finally {
            this.#pending = undefined;
        }
    }
}
