import type { HttpAgent, Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import { principalStringToBytes, toVoid } from "../../utils/mapping";
import { lastOnlineResponse } from "./mappers";
import {
    Empty,
    OnlineUsersLastOnlineArgs,
    OnlineUsersLastOnlineResponse,
    OnlineUsersMarkAsOnlineResponse,
} from "../../typebox";

export class OnlineClient extends CandidService {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
    }

    lastOnline(userIds: string[]): Promise<Record<string, number>> {
        const args = {
            user_ids: userIds.map(principalStringToBytes),
        };
        return this.executeMsgpackQuery(
            "last_online",
            args,
            lastOnlineResponse,
            OnlineUsersLastOnlineArgs,
            OnlineUsersLastOnlineResponse,
        );
    }

    markAsOnline(): Promise<void> {
        return this.executeMsgpackUpdate(
            "mark_as_online",
            {},
            toVoid,
            Empty,
            OnlineUsersMarkAsOnlineResponse,
        );
    }
}
