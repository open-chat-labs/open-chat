import { UserId } from "../model/users";
import { ChatId } from "../model/chats";
import { P2PMessage } from "../model/messages";
import store from "../../store";
import receiveP2PMessage from "../../actions/chats/receiveP2PMessage";
import { SEND_MESSAGE_REQUESTED } from "../../actions/chats/sendMessage";
import { REMOTE_USER_TYPING, REMOTE_USER_STOPPED_TYPING } from "../../actions/chats/userTyping";
import RemoteUserTypingHandler from "../../domain/RemoteUserTypingHandler";
import {
    MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY,
    MARK_MESSAGES_AS_READ_REMOTELY,
    markMessagesAsReadByClientIdRemotely,
    markMessagesAsReadRemotely
} from "../../actions/chats/markMessagesAsRead";
import markRemoteUserOnline from "../../actions/users/markRemoteUserOnline";

class RtcMessageReceiver {
    public handleMessage = (from: UserId, message: string) : void => {
        store.dispatch(markRemoteUserOnline(from));

        const p2pMessageRaw: any = JSON.parse(message);
        switch (p2pMessageRaw.kind) {
            case MARK_MESSAGES_AS_READ_REMOTELY: {
                const { messageIds } = p2pMessageRaw;
                store.dispatch(markMessagesAsReadRemotely(from, messageIds));
                break;
            }

            case MARK_MESSAGES_AS_READ_BY_CLIENT_ID_REMOTELY: {
                const { clientMessageIds } = p2pMessageRaw;
                store.dispatch(markMessagesAsReadByClientIdRemotely(from, clientMessageIds));
                break;
            }

            case SEND_MESSAGE_REQUESTED: {
                const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
                const p2pMessage: P2PMessage = {
                    kind: "p2p",
                    clientMessageId: p2pMessageRaw.clientMessageId,
                    date: new Date(),
                    sender: from,
                    content: p2pMessageRaw.content,
                    repliesTo: p2pMessageRaw.repliesTo
                }

                RemoteUserTypingHandler.markTypingStopped(chatId, from);
                store.dispatch(receiveP2PMessage(chatId, p2pMessage) as any);
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
