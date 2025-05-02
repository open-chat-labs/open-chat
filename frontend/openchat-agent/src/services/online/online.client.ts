import type { HttpAgent, Identity } from "@dfinity/agent";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
import { principalStringToBytes } from "../../utils/mapping";
import { lastOnlineResponse, markAsOnlineResponse } from "./mappers";
import type { MinutesOnline } from "openchat-shared";
import {
    Empty,
    OnlineUsersLastOnlineArgs,
    OnlineUsersLastOnlineResponse,
    OnlineUsersMarkAsOnlineResponse,
} from "../../typebox";

export class OnlineClient extends MsgpackCanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "OnlineUsers");
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

    markAsOnline(): Promise<MinutesOnline> {
        return this.executeMsgpackUpdate(
            "mark_as_online",
            {},
            markAsOnlineResponse,
            Empty,
            OnlineUsersMarkAsOnlineResponse,
        );
    }
}
