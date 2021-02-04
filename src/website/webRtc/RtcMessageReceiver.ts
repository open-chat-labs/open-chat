import { UserId } from "../model/users";
import { ChatId } from "../model/chats";
import { P2PMessage } from "../model/messages";
import store from "../store";
import receiveP2PMessage from "../actions/chats/receiveP2PMessage";
import { SEND_MESSAGE_REQUESTED } from "../actions/chats/sendMessage";
import {
    startedRemotely as typingMessageStarted,
    stoppedRemotely as typingMessageStopped,
    TYPING_MESSAGE_STARTED_REMOTELY,
    TYPING_MESSAGE_STOPPED_REMOTELY
} from "../actions/chats/typingMessage";

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

                store.dispatch(typingMessageStopped(chatId, from));
                store.dispatch(receiveP2PMessage(chatId, p2pMessage));
                break;
            }

            case TYPING_MESSAGE_STARTED_REMOTELY: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                store.dispatch(typingMessageStarted(chatId, from));
                break;
            }

            case TYPING_MESSAGE_STOPPED_REMOTELY: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                store.dispatch(typingMessageStopped(chatId, from));
                break;
            }
        }
    }
}

const receiver = new RtcMessageReceiver();

export default receiver;
