import { Option } from "../model/common";
import { UserId } from "../model/users";
import RtcConnection from "./RtcConnection";
import RtcConnectionFactory from "./RtcConnectionFactory";

class RtcConnectionsStore {
    connections: Map<UserId, RtcConnection> = new Map<UserId, RtcConnection>();

    public exists(user: UserId) : boolean {
        return this.connections.has(user);
    }

    public get(user: UserId) : Option<RtcConnection> {
        return this.connections.get(user) ?? null;
    }

    public create(user: UserId) : RtcConnection {
        const connection = RtcConnectionFactory.createNew(user);
        this.connections.set(user, connection);
        return connection;
    }

    public remove(user: UserId) : boolean {
        const connection = this.connections.get(user);
        if (!connection) {
            return false;
        }
        connection.close();
        this.connections.delete(user);
        return true;
    }
}

const rtcConnectionsStore = new RtcConnectionsStore();

export default rtcConnectionsStore;
