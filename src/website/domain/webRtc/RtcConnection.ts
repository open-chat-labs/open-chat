import { v1 as uuidv1 } from "uuid";
import { Option } from "../model/common";
import { P2PConnectionAnswer, P2PConnectionOffer } from "../model/p2pConnectionDetails";
import { UserId } from "../model/users";

export default class RtcConnection {
    userId: UserId;
    connection: RTCPeerConnection;
    iceCandidates: RTCIceCandidate[] = [];
    onMessage: (message: string) => void;
    dataChannel: Option<RTCDataChannel> = null;
    offerId: Option<string> = null;
    answerId: Option<string> = null;

    constructor(userId: UserId, config: RTCConfiguration, onMessage: (message: string) => void, onDisconnected: () => void) {
        this.userId = userId;
        this.connection = new RTCPeerConnection(config);
        this.onMessage = onMessage;
        this.connection.onicecandidate = (e) => {
            if (e.candidate) {
                this.iceCandidates.push(e.candidate);
            }
        }
        this.connection.onconnectionstatechange = () => {
            console.log(`Connection to user: ${this.userId}. Connection state: ${this.connection.connectionState}`);
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
        console.log(`Creating connection to ${this.userId}`);
    }

    public createOffer = async () : Promise<P2PConnectionOffer> => {
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
            connectionString: offer.sdp!,
            iceCandidates: this.iceCandidates.map(c => JSON.stringify(c)),
            ageSeconds: 0
        };
    }

    public answerRemoteOffer = async (offer: P2PConnectionOffer) : Promise<P2PConnectionAnswer> => {
        if (this.offerId) {
            throw new Error("Offer already set for connection");
        } else if (this.answerId) {
            throw new Error("Answer already set for connection");
        }

        await this.connection.setRemoteDescription({
            sdp: offer.connectionString,
            type: "offer"
        });

        offer.iceCandidates.forEach(c => this.connection.addIceCandidate(JSON.parse(c)));

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
            connectionString: answer.sdp!,
            iceCandidates: this.iceCandidates.map(c => JSON.stringify(c)),
            ageSeconds: 0
        };
    }

    public addRemoteAnswer = async (answer: P2PConnectionAnswer) : Promise<boolean> => {
        if (this.offerId !== answer.offerId) {
            return false;
        }
        await this.connection.setRemoteDescription({
            sdp: answer.connectionString,
            type: "answer"
        });

        answer.iceCandidates.forEach(c => this.connection.addIceCandidate(JSON.parse(c)));

        this.answerId = answer.id;
        return true;
    }

    public isConnected = () : boolean => {
        return this.connection.connectionState === "connected";
    }

    public sendMessage = (message: string) : void => {
        try {
            this.dataChannel?.send(message);
        } catch
        {}
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
            // At this point this.iceCandidates will contain the complete set of ICE candidates.
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
