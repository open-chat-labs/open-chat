import { RtcConnection } from "./RtcConnection";
import { rtcConnectionsStore } from "./RtcConnectionsStore";
import { receiver } from "./RtcMessageReceiver";

class RtcConnectionFactory {
    config: RTCConfiguration;

    constructor() {
        this.config = this.createConfig();
    }

    public createNew(user: string): RtcConnection {
        return new RtcConnection(
            user,
            this.config,
            (m) => receiver.handleMessage(user, m),
            () => rtcConnectionsStore.remove(user)
        );
    }

    createConfig = (): RTCConfiguration => {
        const iceServers: RTCIceServer[] = [
            {
                urls: ["stun:stun.l.google.com:19302"],
            },
        ];

        return {
            iceServers,
        };
    };
}

export const factory = new RtcConnectionFactory();
