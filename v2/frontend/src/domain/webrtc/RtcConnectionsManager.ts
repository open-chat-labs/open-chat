import type { WebRtcMessage } from "./webrtc";
import Peer, { DataConnection } from "peerjs";

export class RtcConnectionsManager {
    private connections: Map<string, DataConnection> = new Map<string, DataConnection>();

    private _peer: Peer | undefined;

    private onMessage?: (message: unknown) => void;

    private cacheConnection(me: string, you: string, conn: DataConnection) {
        this.connections.set(you, conn);

        conn.on("open", () => {
            console.log("c: connection open: ", me, " and ", you);
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

    public init(userId: string): Promise<Peer> {
        if (this._peer) return Promise.resolve(this._peer);

        return new Promise((resolve) => {
            this._peer = new Peer(userId, {
                debug: 2,
            });

            this._peer.on("open", (_id) => {
                if (this._peer) {
                    resolve(this._peer);
                }
            });

            this._peer.on("connection", (conn) => {
                console.log("p: connection receieved on the peer: ", conn.peer);
                this.cacheConnection(userId, conn.peer, conn);
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

    public create(me: string, you: string): void {
        this.init(me).then((peer) => {
            this.cacheConnection(
                me,
                you,
                peer.connect(you, {
                    serialization: "json",
                })
            );
        });
    }

    public sendMessage = (userIds: string[], message: WebRtcMessage): void => {
        userIds.forEach((userId) => {
            const conn = this.connections.get(userId);
            if (conn && conn.open) {
                conn.send(message);
            }
        });
    };
}

export const rtcConnectionsManager = new RtcConnectionsManager();
