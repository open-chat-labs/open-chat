import { Principal } from "@dfinity/agent";
import { canisterId as chats_id } from "dfx-generated/chats";
import { canisterId as p2p_id } from "dfx-generated/p2p";
import { canisterId as user_mgmt_id } from "dfx-generated/user_mgmt";

export type CanisterIds = {
    chats: Principal,
    p2p: Principal,
    userMgmt: Principal
};

export function getCanisterIds() : CanisterIds {
    return {
        chats: Principal.fromText(chats_id),
        p2p: Principal.fromText(p2p_id),
        userMgmt: Principal.fromText(user_mgmt_id)
    };
}
