import type {
    AttachmentContent,
    ChatIdentifier,
    DailyResultContent,
    MessageContext,
} from "@client";

/** The drafts a shared result goes into (`localUpdates.draftMessages`). */
export type ResultDrafts = {
    setAttachment: (key: MessageContext, attachment?: AttachmentContent) => void;
    setTextContent: (key: MessageContext, textContent?: string) => void;
};

/**
 * A daily puzzle result shared into a chat, as the old trees' share did: the card becomes the
 * chat's draft's attachment (staged in its composer, sent with Send, nothing sent until then), and
 * a message written in the picker its text (the card's caption once sent). With no message, the
 * draft's text is left as it was.
 */
export function shareResultToDraft(
    drafts: ResultDrafts,
    chatId: ChatIdentifier,
    card: DailyResultContent,
    message: string,
): void {
    drafts.setAttachment({ chatId }, card);
    const text = message.trim();
    if (text !== "") drafts.setTextContent({ chatId }, text);
}
