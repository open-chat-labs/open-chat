import type { WebRtcMessage } from "@shared";
import type { DataConnection, default as Peer } from "peerjs";

export class RtcConnectionsManager {
    private connections: Map<string, DataConnection> = new Map<string, DataConnection>();

    private _peer: Peer | undefined;

    // the peer being made, until it's there: an init while it is (the app's at sign-in and a
    // chat's connections, as a chat opens) waits for it. Two peers made at once took the same id,
    // and the second, refused by the signalling server ("ID-TAKEN"), replaced the first, so no
    // connection was ever made.
    private _starting: Promise<Peer> | undefined;

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

    // The TURN servers to relay through, or none (direct connections only) when there are no
    // credentials: no key configured (a local build has no OC_METERED_APIKEY), or the service
    // refusing the key or failing. It answers a refusal with `{ "error": … }`, not a list, which
    // RTCPeerConnection throws on ("Failed to read the 'iceServers' property"), so no peer
    // connected and typing and read receipts went nowhere.
    private async getIceServers(meteredApiKey: string): Promise<RTCIceServer[]> {
        if (!meteredApiKey) return [];
        try {
            const resp = await fetch(
                `https://openchat.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`,
            );
            const servers: unknown = await resp.json();
            if (Array.isArray(servers)) return servers;
            console.warn("RTC: no TURN credentials, connecting directly only: ", servers);
        } catch (err) {
            console.warn("RTC: couldn't fetch TURN credentials, connecting directly only: ", err);
        }
        return [];
    }

    private isMobileDevice(): boolean {
        return /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent);
    }

    private getMyConnectionId(userId: string) {
        const prefix = this._mobile ? "m" : "d";
        return `${prefix}_${userId}`;
    }

    public init(me: string, meteredApiKey: string): Promise<Peer> {
        // checked before `_peer`, which is set as soon as the peer is made, before it opens
        if (this._starting) return this._starting;
        if (this._peer?.destroyed) {
            this.resetAfterConnectionClosed();
        } else if (this._peer) {
            return Promise.resolve(this._peer);
        }
        this._starting = this.startPeer(me, meteredApiKey);
        return this._starting;
    }

    private async startPeer(me: string, meteredApiKey: string): Promise<Peer> {
        try {
            // peerjs (and its webrtc-adapter dependency) is only loaded once a peer is needed
            const [iceServers, { default: PeerCtor }] = await Promise.all([
                this.getIceServers(meteredApiKey),
                import("peerjs"),
            ]);
            return await this.makePeer(me, iceServers, PeerCtor);
        } finally {
            // the peer is open (and `_peer` from now on), or closed before it opened
            this._starting = undefined;
        }
    }

    private makePeer(me: string, iceServers: RTCIceServer[], PeerCtor: typeof Peer): Promise<Peer> {
        return new Promise((resolve, reject) => {
            const connectionId = this.getMyConnectionId(me);
            let opened = false;

            this._peer = new PeerCtor(connectionId, {
                // host: "localhost",
                // port: 4000,
                // secure: false,
                config: {
                    iceServers,
                },
            });

            this._peer.on("open", (_id) => {
                opened = true;
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

                // reconnect() throws if the peer has already re-established the connection
                // by the time this handler runs
                if (this._peer && !this._peer.destroyed && this._peer.disconnected) {
                    try {
                        this._peer.reconnect();
                    } catch (err) {
                        console.debug("RTC: peer reconnect failed: ", err);
                    }
                }
            });

            this._peer.on("close", () => {
                console.debug("RTC: peer connection closed");
                this.resetAfterConnectionClosed();
                // a peer that never opened (the signalling server refused it) fails its init, so
                // the next init makes a new one instead of waiting on this one for ever
                if (!opened) reject(new Error("RTC: peer closed before it opened"));
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
        this.init(me, meteredApiKey)
            .then((peer) => {
                [`m_${them}`, `d_${them}`]
                    .filter((c) => !this.exists(c))
                    .forEach((c) => {
                        this.cacheConnection(
                            peer.id,
                            c,
                            peer.connect(c, { serialization: "json" }),
                        );
                    });
            })
            .catch((err) => console.debug("RTC: no peer to connect to the user from: ", err));
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

    private resetAfterConnectionClosed() {
        this.connections.clear();
        this._peer = undefined;
    }
}

export const rtcConnectionsManager = new RtcConnectionsManager();
