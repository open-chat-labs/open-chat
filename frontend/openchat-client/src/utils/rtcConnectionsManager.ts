import type { WebRtcMessage } from "openchat-shared";
import Peer, { type DataConnection } from "peerjs";

export class RtcConnectionsManager {
    private connections: Map<string, DataConnection> = new Map<string, DataConnection>();

    private _peer: Peer | undefined;

    private _mobile: boolean;

    constructor() {
        this._mobile = this.isMobileDevice();
    }

    private onMessage?: (message: unknown) => void;

    private cacheConnection(
        myConnectionId: string,
        theirConnectionId: string,
        conn: DataConnection,
    ): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            conn.on("open", () => {
                this.connections.set(theirConnectionId, conn);
                console.debug("RTC: connection open: ", myConnectionId, " and ", theirConnectionId);
                resolve(true);
            });

            conn.on("data", (data) => {
                console.debug("RTC: connection received data: ", data);
                if (this.onMessage) {
                    this.onMessage(data);
                }
            });

            conn.on("error", (err) => {
                console.debug("RTC: connection error: ", err);
            });
        });
    }

    private getIceServers(meteredApiKey: string) {
        return fetch(
            `https://openchat.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`,
        ).then((resp) => resp.json());
    }

    private isMobileDevice(): boolean {
        return /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent);
    }

    private getMyConnectionId(userId: string) {
        const prefix = this._mobile ? "m" : "d";
        return `${prefix}_${userId}`;
    }

    public async init(me: string, meteredApiKey: string): Promise<Peer> {
        if (this._peer) return Promise.resolve(this._peer);

        const iceServers = await this.getIceServers(meteredApiKey);

        return new Promise((resolve) => {
            const connectionId = this.getMyConnectionId(me);

            this._peer = new Peer(connectionId, {
                // host: "localhost",
                // port: 9000,
                // secure: false,
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
                console.debug("RTC: connection received on the peer: ", conn.peer);
                this.cacheConnection(connectionId, conn.peer, conn);
            });

            this._peer.on("disconnected", () => {
                console.debug("RTC: peer lost connection will try to reconnect");

                if (this._peer) {
                    this._peer.reconnect();
                }
            });

            this._peer.on("close", () => {
                console.debug("RTC: peer connection closed");
            });

            this._peer.on("error", (err) => {
                console.debug("RTC: peer connection error: ", err);
            });
        });
    }

    public subscribe(onMessage: (message: unknown) => void): void {
        this.onMessage = onMessage;
    }

    public unsubscribe(): void {
        this.onMessage = undefined;
    }

    private exists(connectionId: string): boolean {
        return this.connections.has(connectionId);
    }

    public create(me: string, them: string, meteredApiKey: string): void {
        this.init(me, meteredApiKey).then((peer) => {
            [`m_${them}`, `d_${them}`]
                .filter((c) => !this.exists(c))
                .forEach((c) => {
                    this.cacheConnection(peer.id, c, peer.connect(c, { serialization: "json" }));
                });
        });
    }

    public disconnectFromUser(them: string): void {
        [`m_${them}`, `d_${them}`].forEach((c) => this.connections.delete(c));
    }

    public sendMessage = (userIds: string[], message: WebRtcMessage): void => {
        const connectionIds = userIds.flatMap((u) => [`m_${u}`, `d_${u}`]);
        connectionIds.forEach((connectionId) => {
            const conn = this.connections.get(connectionId);
            if (conn && conn.open) {
                try {
                    conn.send(message);
                } catch (e) {
                    console.debug("Error sending WebRTC message to " + connectionId, e);
                }
            }
        });
    };
}

export const rtcConnectionsManager = new RtcConnectionsManager();
