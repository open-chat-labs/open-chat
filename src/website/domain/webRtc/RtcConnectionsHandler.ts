import { Option, Timestamp } from "../model/common";
import { P2PConnectionAnswer, P2PConnectionDetails, P2PConnectionOffer } from "../model/p2pConnectionDetails";
import { UserId } from "../model/users";
import RtcConnectionsStore from "./RtcConnectionsStore";
import p2pService from "../../services/p2p/service";
import RtcConnection from "./RtcConnection";

class RtcConnectionsHandler {
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

    public sendMessage = (users: UserId[], data: string) : void => {
        for (const user of users) {
            const connection = RtcConnectionsStore.get(user);
            if (connection && connection.isConnected()) {
                connection.sendMessage(data);
            }
        }
    }

    createConnection = async (user: UserId, onlyIfNotExists: boolean = true) : Promise<RtcConnection> => {
        const oldConnection = RtcConnectionsStore.get(user);
        if (oldConnection) {
            if (onlyIfNotExists) {
                return oldConnection;
            }
            RtcConnectionsStore.remove(user);
        }
        const connection = RtcConnectionsStore.create(user);

        const offer = await connection.createOffer();
        const addOfferResponse = await p2pService.addOffer({
            id: offer.id,
            userId: offer.userId,
            connectionString: offer.connectionString,
            iceCandidates: offer.iceCandidates
        });

        if (addOfferResponse.existingCounterOffer) {
            await this.handleRemoteOffer(addOfferResponse.existingCounterOffer);
        }

        return connection;
    }

    handleRemoteConnectionDetails = async (connectionDetails: P2PConnectionDetails) : Promise<void> => {
        if (connectionDetails.kind === "offer") {
            await this.handleRemoteOffer(connectionDetails);
        } else {
            await this.handleRemoteAnswer(connectionDetails);
        }
    }

    handleRemoteOffer = async (offer: P2PConnectionOffer) : Promise<void> => {
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
            connectionString: answer.connectionString,
            iceCandidates: answer.iceCandidates
        });
    }

    handleRemoteAnswer = async (answer: P2PConnectionAnswer) : Promise<void> => {
        const rtcConnection = RtcConnectionsStore.get(answer.userId);
        if (rtcConnection) {
            await rtcConnection.addRemoteAnswer(answer);
        }
    }
}

const handler = new RtcConnectionsHandler();

export default handler;
