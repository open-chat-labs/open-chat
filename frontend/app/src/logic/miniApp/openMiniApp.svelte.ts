// The bot's app opened from a MiniApp card, if one is. It's shown by a frame mounted beside the chat
// rather than in the card's row, which the message list drops once it scrolls far out of view.

import type { ChatIdentifier } from "@client";

export type OpenMiniApp = {
    url: URL;
    botName: string;
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    messageId: bigint;
    // the bot which posted the card
    botId: string;
};

class OpenMiniAppState {
    current = $state<OpenMiniApp | undefined>(undefined);

    open(app: OpenMiniApp): void {
        this.current = app;
    }

    close(): void {
        this.current = undefined;
    }
}

export const openMiniApp = new OpenMiniAppState();
