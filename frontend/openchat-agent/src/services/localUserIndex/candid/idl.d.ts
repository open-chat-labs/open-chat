import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    GroupCanisterGroupChatSummary,
    JoinGroupResponse,
    GateCheckFailedReason,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
    GateCheckFailedReason as ApiGateCheckFailedReason,
};

export const idlFactory: IDL.InterfaceFactory;
