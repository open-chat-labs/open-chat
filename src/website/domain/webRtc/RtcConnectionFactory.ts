import { UserId } from "../model/users";
import RtcConnection from "./RtcConnection";
import RtcConnectionsStore from "./RtcConnectionsStore";
import RtcMessageReceiver from "./RtcMessageReceiver";

class RtcConnectionFactory {
    config: RTCConfiguration;
    
    constructor() {
        this.config = this.createConfig();
    }

    public createNew(user: UserId) : RtcConnection {
        return new RtcConnection(
            user,
            this.config,
            m => RtcMessageReceiver.handleMessage(user, m),
            () => RtcConnectionsStore.remove(user));
    }

    createConfig = () : RTCConfiguration => {
        const iceServers: RTCIceServer[] = [{
            urls: [
                "stun:stun.l.google.com:19302"
            ]
        }];

        return {
            iceServers
        }
    }
}

const factory = new RtcConnectionFactory();

export default factory;
