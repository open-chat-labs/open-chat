import { UserId } from "../model/users";
import { ChatId } from "../model/chats";
import { P2PMessage } from "../model/messages";
import store from "../store";
import receiveP2PMessage from "../actions/chats/receiveP2PMessage";
import { SEND_MESSAGE_REQUESTED } from "../actions/chats/sendMessage";
import { REMOTE_USER_TYPING, REMOTE_USER_STOPPED_TYPING } from "../actions/chats/userTyping";
import RemoteUserTypingHandler from "../utils/RemoteUserTypingHandler";

class RtcMessageReceiver {
    public handleMessage = (from: UserId, message: string) : void => {
        const p2pMessageRaw: any = JSON.parse(message);
        switch (p2pMessageRaw.kind) {
            case SEND_MESSAGE_REQUESTED: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                const p2pMessage: P2PMessage = {
                    kind: "p2p",
                    clientMessageId: p2pMessageRaw.clientMessageId,
                    date: new Date(),
                    sender: from,
                    content: p2pMessageRaw.content
                }

                RemoteUserTypingHandler.markTypingStopped(chatId, from);
                store.dispatch(receiveP2PMessage(chatId, p2pMessage));
                break;
            }

            case REMOTE_USER_TYPING: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                RemoteUserTypingHandler.markTyping(chatId, from);
                break;
            }

            case REMOTE_USER_STOPPED_TYPING: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                RemoteUserTypingHandler.markTypingStopped(chatId, from);
                break;
            }
        }
    }
}

const receiver = new RtcMessageReceiver();

export default receiver;
