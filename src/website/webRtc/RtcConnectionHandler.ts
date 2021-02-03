import { ConfirmedChat } from "../model/chats";
import { Option, Timestamp } from "../model/common";
import { MessageContent } from "../model/messages";
import { p2pConnectionAnswer, p2pConnectionDetails, p2pConnectionOffer } from "../model/p2pConnectionDetails";
import { UserId } from "../model/users";
import * as chatFunctions from "../model/chats";
import RtcConnectionsStore from "./RtcConnectionsStore";
import p2pService from "../services/p2p/service";

export class RtcConnectionHandler {
    lastUpdated: Option<Timestamp> = null;

    public setupMissingConnections = async (users: UserId[]) : Promise<void> => {
        const promises: Promise<void>[] = [];
        for (const user of users) {
            if (!RtcConnectionsStore.exists(user)) {
                promises.push(new Promise<void>(() => this.createConnection(user)));
            }
        }
        await Promise.all(promises);
    }

    public getConnections = async () : Promise<void> => {
        const response = await p2pService.getConnectionDetails(this.lastUpdated);
        if (response.kind === "success") {
            if (response.connections.length) {
                const promises: Promise<void>[] = response.connections.map(this.handleRemoteConnectionDetails);
                await Promise.all(promises);
            }
            this.lastUpdated = response.timestamp;
        }
    }

    public sendMessage = (chat: ConfirmedChat, clientMessageId: string, content: MessageContent, myUserId: UserId) : void => {
        const users = chatFunctions.getUsers(chat);
        const p2pMessage = JSON.stringify({
            chatId: chat.chatId,
            sender: myUserId,
            clientMessageId,
            content
        });

        for (const user of users) {
            const connection = RtcConnectionsStore.get(user);
            if (connection && connection.isConnected()) {
                connection.sendMessage(p2pMessage);
            }
        }
    }

    createConnection = async (user: UserId) : Promise<void> => {
        const connection = RtcConnectionsStore.create(user);

        const offer = await connection.createOffer();
        const addOfferResponse = await p2pService.addOffer({
            id: offer.id,
            userId: offer.userId,
            connectionString: offer.connectionString
        });

        if (addOfferResponse.existingCounterOffer) {
            await this.handleRemoteOffer(addOfferResponse.existingCounterOffer);
        }
    }

    handleRemoteConnectionDetails = async (connectionDetails: p2pConnectionDetails) : Promise<void> => {
        if (connectionDetails.kind === "offer") {
            await this.handleRemoteOffer(connectionDetails);
        } else {
            await this.handleRemoteAnswer(connectionDetails);
        }
    }

    handleRemoteOffer = async (offer: p2pConnectionOffer) : Promise<void> => {
        let rtcConnection = RtcConnectionsStore.get(offer.userId);
        if (rtcConnection) {
            if (rtcConnection.offerId === offer.id) {
                return;
            }
            RtcConnectionsStore.remove(offer.userId);
        }
        rtcConnection = RtcConnectionsStore.create(offer.userId);
        const answer = await rtcConnection.answerRemoteOffer(offer);
        await p2pService.addAnswer({
            id: answer.id,
            offerId: answer.offerId,
            userId: answer.userId,
            connectionString: answer.connectionString
        });
    }

    handleRemoteAnswer = async (answer: p2pConnectionAnswer) : Promise<void> => {
        const rtcConnection = RtcConnectionsStore.get(answer.userId);
        if (rtcConnection) {
            await rtcConnection.addRemoteAnswer(answer);
            if (rtcConnection.connection.connectionState !== "connecting" && rtcConnection.connection.connectionState !== "connected") {
                // Something went wrong, retry the connection
                console.log("Retrying connection");
                RtcConnectionsStore.remove(answer.userId);
                await this.createConnection(answer.userId);
            }
        }
    }
}

const handler = new RtcConnectionHandler();

export default handler;
