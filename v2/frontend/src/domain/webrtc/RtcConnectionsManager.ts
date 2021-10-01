import { RtcConnection } from "./RtcConnection";
import type { WebRtcAnswer, WebRtcMessage, WebRtcOffer } from "./webrtc";

export class RtcConnectionsManager {
    private connections: Map<string, RtcConnection> = new Map<string, RtcConnection>();

    private config: RTCConfiguration = {
        iceServers: [
            {
                urls: ["stun:stun.l.google.com:19302"],
            },
        ],
    };

    private onMessage?: (userId: string, message: string) => void;

    public subscribe(onMessage: (userId: string, message: string) => void): void {
        this.onMessage = onMessage;
    }

    public unsubscribe(): void {
        this.onMessage = undefined;
    }

    public exists(user: string): boolean {
        return this.connections.has(user);
    }

    public get(user: string): RtcConnection | undefined {
        return this.connections.get(user);
    }

    public create(userId: string): RtcConnection {
        const conn = new RtcConnection(
            userId,
            this.config,
            (message) => {
                if (this.onMessage) {
                    this.onMessage(userId, message);
                }
            },
            () => this.remove(userId)
        );
        this.connections.set(userId, conn);
        return conn;
    }

    public remove(user: string): boolean {
        const connection = this.connections.get(user);
        if (!connection) {
            return false;
        }
        connection.close();
        this.connections.delete(user);
        return true;
    }

    public createAnswer(fromUserId: string, offer: WebRtcOffer): Promise<WebRtcAnswer> {
        let conn = this.get(offer.fromUserId);
        if (conn) {
            rtcConnectionsManager.remove(offer.fromUserId);
        }
        conn = rtcConnectionsManager.create(offer.fromUserId);
        return conn.answerRemoteOffer(fromUserId, offer);
    }

    public async handleRemoteAnswer(answer: WebRtcAnswer): Promise<void> {
        const conn = this.get(answer.fromUserId);
        if (conn) {
            await conn.addRemoteAnswer(answer);
        }
    }

    public sendMessage = (userIds: string[], message: WebRtcMessage): void => {
        console.log("Sending message: ", message);
        userIds.forEach((userId) => {
            const conn = this.get(userId);
            if (conn && conn.isConnected()) {
                conn.sendMessage(JSON.stringify(message));
            }
        });
    };
}

export const rtcConnectionsManager = new RtcConnectionsManager();
