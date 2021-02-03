import { v1 as uuidv1 } from "uuid";
import { Option } from "../model/common";
import { p2pConnectionAnswer, p2pConnectionOffer } from "../model/p2pConnectionDetails";
import { UserId } from "../model/users";

export default class RtcConnection {
    userId: UserId;
    connection: RTCPeerConnection;
    onMessage: (message: string) => void;
    dataChannel: Option<RTCDataChannel> = null;
    offerId: Option<string> = null;
    answerId: Option<string> = null;

    constructor(userId: UserId, onMessage: (message: string) => void, onDisconnected: () => void) {
        this.userId = userId;
        this.connection = new RTCPeerConnection();
        this.onMessage = onMessage;
        this.connection.onconnectionstatechange = () => {
            if (this.connection.connectionState === "disconnected" ||
                this.connection.connectionState === "closed" ||
                this.connection.connectionState === "failed") {
                onDisconnected();
            }
        }
        this.connection.ondatachannel = (e) => {
            this.configureDataChannel(e.channel);
            this.dataChannel = e.channel;
        }
    }

    public createOffer = async () : Promise<p2pConnectionOffer> => {
        if (this.offerId) {
            throw new Error("Offer already set for connection");
        }

        const offerId = this.offerId = uuidv1().toString();

        const dataChannel = this.dataChannel = this.connection.createDataChannel(offerId, { ordered: true });
        this.configureDataChannel(dataChannel);

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);

        await this.waitUntilIceGatheringIsComplete();

        return {
            kind: "offer",
            id: offerId,
            userId: this.userId,
            connectionString: this.connection.localDescription!.sdp,
            ageSeconds: 0
        };
    }

    public answerRemoteOffer = async (offer: p2pConnectionOffer) : Promise<p2pConnectionAnswer> => {
        if (this.offerId) {
            throw new Error("Offer already set for connection");
        } else if (this.answerId) {
            throw new Error("Answer already set for connection");
        }

        await this.connection.setRemoteDescription({
            sdp: offer.connectionString,
            type: "offer"
        });
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);

        this.offerId = offer.id;
        const answerId = this.answerId = uuidv1().toString();

        await this.waitUntilIceGatheringIsComplete();

        return {
            kind: "answer",
            id: answerId,
            offerId: offer.id,
            userId: this.userId,
            connectionString: this.connection.localDescription!.sdp,
            ageSeconds: 0
        };
    }

    public addRemoteAnswer = async (answer: p2pConnectionAnswer) : Promise<boolean> => {
        if (this.offerId !== answer.offerId) {
            return false;
        }
        await this.connection.setRemoteDescription({
            sdp: answer.connectionString,
            type: "answer"
        });

        this.answerId = answer.id;
        return true;
    }

    public isConnected = () : boolean => {
        return this.connection.connectionState === "connected";
    }

    public sendMessage = (message: string) : void => {
        this.dataChannel?.send(message);
    }

    public close = () : void => {
        this.connection.close();
    }

    waitUntilIceGatheringIsComplete = async () : Promise<void> => {
        await new Promise(resolve => {
            if (this.connection.iceGatheringState === "complete") {
                resolve(null);
            }

            // Start a fallback timer which resolves this promise in 1 second so that it cannot stay unresolved forever
            const timeout = setTimeout(() => resolve(null), 1000);

            // Listen for onicegatheringstatechange events and resolve the promise once the ice gathering is complete.
            // The localdescription.sdp value will then contain all of the ICE candidates
            this.connection.addEventListener("onicegatheringstatechange", () => {
                if (this.connection.iceGatheringState === "complete") {
                    clearTimeout(timeout);
                    resolve(null);
                }
            });
        });
    }

    configureDataChannel = (dataChannel: RTCDataChannel) : void => {
        dataChannel.binaryType = "arraybuffer";
        dataChannel.onmessage = (e) => this.onMessage(e.data);
    }
}
