import { Option, Timestamp } from "../model/common";
import { P2PConnectionAnswer, P2PConnectionDetails, P2PConnectionOffer } from "../model/p2pConnectionDetails";
import { UserId } from "../model/users";
import RtcConnectionsStore from "./RtcConnectionsStore";
import p2pService from "../../services/p2p/service";

class RtcConnectionsHandler {
    lastUpdated: Option<Timestamp> = null;

    public setupMissingConnections = async (users: UserId[]) : Promise<void> => {
        const createOfferPromises = users
            .filter(u => !RtcConnectionsStore.exists(u))
            .map(this.createOffer);

        if (createOfferPromises.length) {
            const offers = await Promise.all(createOfferPromises);

            await p2pService.addOffers({
                offers
            });
        }
    }

    public getConnections = async () : Promise<number> => {
        const response = await p2pService.getConnectionDetails(this.lastUpdated);
        if (response.kind !== "success") {
            return 0;
        }

        if (response.connections.length) {
            await this.handleRemoteConnectionDetails(response.connections);
        }
        this.lastUpdated = response.timestamp;
        return response.connections.length;
    }

    public sendMessage = (users: UserId[], data: string) : void => {
        for (const user of users) {
            const connection = RtcConnectionsStore.get(user);
            if (connection && connection.isConnected()) {
                connection.sendMessage(data);
            }
        }
    }

    createOffer = async (user: UserId) : Promise<P2PConnectionOffer> => {
        const connection = RtcConnectionsStore.create(user);

        return await connection.createOffer();
    }

    handleRemoteConnectionDetails = async (connectionDetails: P2PConnectionDetails[]) : Promise<void> => {
        const offers: P2PConnectionOffer[] = [];
        const handleRemoteAnswerPromises: Promise<void>[] = [];
        for (const cd of connectionDetails) {
            if (cd.kind === "offer") {
                offers.push(cd);
            } else {
                handleRemoteAnswerPromises.push(this.handleRemoteAnswer(cd));
            }
        }

        if (offers.length) {
            const createAnswerPromises = offers.map(this.createAnswer);

            const answers = await Promise.all(createAnswerPromises);

            await p2pService.addAnswers({
                answers
            });
        }

        await Promise.all(handleRemoteAnswerPromises);
    }

    createAnswer = async (offer: P2PConnectionOffer) : Promise<P2PConnectionAnswer> => {
        let rtcConnection = RtcConnectionsStore.get(offer.userId);
        if (rtcConnection) {
            RtcConnectionsStore.remove(offer.userId);
        }
        rtcConnection = RtcConnectionsStore.create(offer.userId);

        return await rtcConnection.answerRemoteOffer(offer);
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
