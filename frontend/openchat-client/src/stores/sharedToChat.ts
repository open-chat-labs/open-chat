import type { AttachmentContent, ChatIdentifier } from "@shared";
import { writable } from "../utils/stores";

/**
 * Something shared into a chat from outside its conversation (a daily puzzle result, from the
 * puzzle's chat picker): the attachment for its draft, and the text written with it. It waits here
 * for that chat's conversation to take it into the draft, which asks first where it would take a
 * staged payment's place, and starts its composer again from the text (it reads a draft's text only
 * as it mounts), so it lands the same whether the chat was open already or opens with it.
 */
export type SharedToChat = {
    chatId: ChatIdentifier;
    attachment: AttachmentContent;
    text: string;
};

export const sharedToChatStore = writable<SharedToChat | undefined>(undefined);
