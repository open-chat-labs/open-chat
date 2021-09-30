import type { RtcConnection } from "./RtcConnection";
import { factory } from "./RtcConnectionFactory";

export class RtcConnectionsStore {
    connections: Map<string, RtcConnection> = new Map<string, RtcConnection>();

    public exists(user: string): boolean {
        return this.connections.has(user);
    }

    public get(user: string): RtcConnection | undefined {
        return this.connections.get(user);
    }

    public create(user: string): RtcConnection {
        const connection = factory.createNew(user);
        this.connections.set(user, connection);
        return connection;
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
}

export const rtcConnectionsStore = new RtcConnectionsStore();
