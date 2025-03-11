import type { HttpAgent, Identity } from "@dfinity/agent";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
import { principalStringToBytes } from "../../utils/mapping";
import { lastOnlineResponse, markAsOnlineResponse } from "./mappers";
import {
    Empty,
    OnlineUsersLastOnlineArgs,
    OnlineUsersLastOnlineResponse,
    OnlineUsersMarkAsOnlineResponse,
    OnlineUsersMinutesOnlineArgs,
    OnlineUsersMinutesOnlineResponse,
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

    markAsOnline(): Promise<number> {
        return this.executeMsgpackUpdate(
            "mark_as_online",
            {},
            markAsOnlineResponse,
            Empty,
            OnlineUsersMarkAsOnlineResponse,
        );
    }

    minutesOnline(year: number, month: number): Promise<number> {
        return this.executeMsgpackQuery(
            "minutes_online",
            { year, month },
            (resp) => resp.Success,
            OnlineUsersMinutesOnlineArgs,
            OnlineUsersMinutesOnlineResponse,
        );
    }
}
