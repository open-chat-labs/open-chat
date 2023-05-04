import type { WebRtcMessage } from "openchat-shared";
import Peer, { DataConnection } from "peerjs";

export class RtcConnectionsManager {
    private connections: Map<string, DataConnection> = new Map<string, DataConnection>();

    private _peer: Peer | undefined;

    private onMessage?: (message: unknown) => void;

    private cacheConnection(me: string, them: string, conn: DataConnection) {
        conn.on("open", () => {
            this.connections.set(them, conn);
            console.log("c: connection open: ", me, " and ", them);
        });

        conn.on("data", (data) => {
            console.log("c: connection received data: ", data);
            if (this.onMessage) {
                this.onMessage(data);
            }
        });

        conn.on("error", (err) => {
            console.log("c: connection error: ", err);
        });
    }

    private getIceServers(meteredApiKey: string) {
        return fetch(
            `https://openchat.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`
        ).then((resp) => resp.json());
    }

    public async init(me: string, meteredApiKey: string): Promise<Peer> {
        if (this._peer) return Promise.resolve(this._peer);

        const iceServers = await this.getIceServers(meteredApiKey);

        return new Promise((resolve) => {
            this._peer = new Peer(me, {
                config: {
                    iceServers,
                },
            });

            this._peer.on("open", (_id) => {
                if (this._peer) {
                    resolve(this._peer);
                }
            });

            this._peer.on("connection", (conn) => {
                console.log("p: connection received on the peer: ", conn.peer);
                this.cacheConnection(me, conn.peer, conn);
            });

            this._peer.on("disconnected", () => {
                console.log("p: peer lost connection will try to reconnect");

                if (this._peer) {
                    this._peer.reconnect();
                }
            });

            this._peer.on("close", () => {
                console.log("p: peer connection closed");
            });

            this._peer.on("error", (err) => {
                console.log("p: peer connection error: ", err);
            });
        });
    }

    public subscribe(onMessage: (message: unknown) => void): void {
        this.onMessage = onMessage;
    }

    public unsubscribe(): void {
        this.onMessage = undefined;
    }

    public exists(user: string): boolean {
        return this.connections.has(user);
    }

    public create(me: string, them: string, meteredApiKey: string): void {
        this.init(me, meteredApiKey).then((peer) => {
            this.cacheConnection(
                me,
                them,
                peer.connect(them, {
                    serialization: "json",
                })
            );
        });
    }

    public sendMessage = (userIds: string[], message: WebRtcMessage): void => {
        userIds.forEach((userId) => {
            const conn = this.connections.get(userId);
            if (conn && conn.open) {
                try {
                    conn.send(message);
                } catch (e) {
                    console.debug("Error sending WebRTC message to " + userId, e);
                }
            }
        });
    };
}

export const rtcConnectionsManager = new RtcConnectionsManager();
