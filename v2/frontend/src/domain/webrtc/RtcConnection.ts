import { v1 as uuidv1 } from "uuid";
import type { WebRtcAnswer, WebRtcOffer } from "./webrtc";

export class RtcConnection {
    toUserId: string;
    connection: RTCPeerConnection;
    iceCandidates: RTCIceCandidate[] = [];
    onMessage: (message: string) => void;
    dataChannel?: RTCDataChannel;
    offerId?: string;
    answerId?: string;

    constructor(
        userId: string,
        config: RTCConfiguration,
        onMessage: (message: string) => void,
        onDisconnected: () => void
    ) {
        this.toUserId = userId;
        this.connection = new RTCPeerConnection(config);
        this.onMessage = onMessage;
        this.connection.onicecandidate = (e) => {
            if (e.candidate) {
                this.iceCandidates.push(e.candidate);
            }
        };

        this.connection.onicecandidateerror = (ev: Event) => {
            console.log("canidadate error", ev);
        };

        this.connection.onconnectionstatechange = () => {
            console.log(
                `Connection to user: ${this.toUserId}. Connection state: ${this.connection.connectionState}`
            );
            if (
                this.connection.connectionState === "disconnected" ||
                this.connection.connectionState === "closed" ||
                this.connection.connectionState === "failed"
            ) {
                onDisconnected();
            }
        };

        this.connection.ondatachannel = (e) => {
            this.configureDataChannel(e.channel);
            this.dataChannel = e.channel;
        };

        console.log(`Creating connection to ${this.toUserId}`);
    }

    public createOffer = async (fromUserId: string): Promise<WebRtcOffer> => {
        if (this.offerId) {
            throw new Error("Offer already set for connection");
        }

        const offerId = (this.offerId = uuidv1().toString());

        const dataChannel = (this.dataChannel = this.connection.createDataChannel(offerId, {
            ordered: true,
        }));
        this.configureDataChannel(dataChannel);

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);

        await this.waitUntilIceGatheringIsComplete();

        return {
            kind: "offer",
            endpoint: {
                id: offerId,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                connectionString: offer.sdp!,
                iceCandidates: this.iceCandidates.map((c) => JSON.stringify(c)),
            },
            fromUserId,
        };
    };

    public answerRemoteOffer = async (
        fromUserId: string,
        offer: WebRtcOffer
    ): Promise<WebRtcAnswer> => {
        if (this.offerId) {
            throw new Error("Offer already set for connection");
        } else if (this.answerId) {
            throw new Error("Answer already set for connection");
        }

        await this.connection.setRemoteDescription({
            sdp: offer.endpoint.connectionString,
            type: "offer",
        });

        offer.endpoint.iceCandidates.forEach((c) => this.connection.addIceCandidate(JSON.parse(c)));

        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);

        this.offerId = offer.endpoint.id;
        const answerId = (this.answerId = uuidv1().toString());

        await this.waitUntilIceGatheringIsComplete();

        return {
            kind: "answer",
            endpoint: {
                id: answerId,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                connectionString: answer.sdp!,
                iceCandidates: this.iceCandidates.map((c) => JSON.stringify(c)),
            },
            offerId: offer.endpoint.id,
            fromUserId,
        };
    };

    public addRemoteAnswer = async (answer: WebRtcAnswer): Promise<boolean> => {
        if (this.offerId !== answer.offerId) {
            return false;
        }
        await this.connection.setRemoteDescription({
            sdp: answer.endpoint.connectionString,
            type: "answer",
        });

        answer.endpoint.iceCandidates.forEach((c) =>
            this.connection.addIceCandidate(JSON.parse(c))
        );

        this.answerId = answer.endpoint.id;
        return true;
    };

    public isConnected = (): boolean => {
        return this.connection.connectionState === "connected";
    };

    public sendMessage = (message: string): void => {
        try {
            this.dataChannel?.send(message);
        } catch (err) {
            console.error("Error sending p2p message: ", err);
        }
    };

    public close = (): void => {
        this.connection.close();
    };

    waitUntilIceGatheringIsComplete = async (): Promise<void> => {
        await new Promise((resolve) => {
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
    };

    configureDataChannel = (dataChannel: RTCDataChannel): void => {
        dataChannel.binaryType = "arraybuffer";
        dataChannel.onmessage = (e) => this.onMessage(e.data);
    };
}
