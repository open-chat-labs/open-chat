import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    GroupCanisterGroupChatSummary,
    JoinGroupResponse,
} from "./types";
export {
    _SERVICE as LocalUserIndexService,
    GroupCanisterGroupChatSummary as ApiGroupCanisterGroupChatSummary,
    JoinGroupResponse as ApiJoinGroupResponse,
};

export const idlFactory: IDL.InterfaceFactory;
