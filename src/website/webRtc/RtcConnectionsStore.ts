import RtcConnection from "./RtcConnection";
import { ChatId } from "../model/chats";
import { Option } from "../model/common";
import { P2PMessage } from "../model/messages";
import { UserId } from "../model/users";
import store from "../store";
import receiveP2PMessage from "../actions/chats/receiveP2PMessage";

class RtcConnectionsStore {
    connections: Map<UserId, RtcConnection> = new Map<UserId, RtcConnection>();

    public exists(user: UserId) : boolean {
        return this.connections.has(user);
    }

    public get(user: UserId) : Option<RtcConnection> {
        return this.connections.get(user) ?? null;
    }

    public create(user: UserId) : RtcConnection {
        console.log("connection created for " + user);
        const connection = new RtcConnection(user, this.handleReceivedMessage, () => this.remove(user));
        this.connections.set(user, connection);
        return connection;
    }

    public remove(user: UserId) : boolean {
        const connection = this.connections.get(user);
        if (!connection) {
            return false;
        }
        connection.close();
        this.connections.delete(user);
        return true;
    }

    handleReceivedMessage = (message: string) : void => {
        const p2pMessageRaw = JSON.parse(message);
        const chatId: ChatId = BigInt(p2pMessageRaw.chatId);
        const p2pMessage: P2PMessage = {
            kind: "p2p",
            clientMessageId: p2pMessageRaw.clientMessageId,
            date: new Date(),
            sender: p2pMessageRaw.sender,
            content: p2pMessageRaw.content
        }

        store.dispatch(receiveP2PMessage(chatId, p2pMessage))
    }
}

const rtcConnectionsStore = new RtcConnectionsStore();

export default rtcConnectionsStore;
