import { Principal } from "@dfinity/agent";
import * as urlFunctions from "./urlFunctions";

export function extractCanisterIds() {
    const query = urlFunctions.extractQueryStringAsObject();

    return query["canisterId"] 
        ? {
            // Local canister ids
            chats: Principal.fromText("rwlgt-iiaaa-aaaaa-aaaaa-cai"),
            p2p: Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai"),
            userMgmt: Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai")
        }
        : {
            // IC canister ids
            chats: Principal.fromText("sadjp-vqaaa-aaaab-qaipa-cai"),
            p2p: Principal.fromText("shcp3-yiaaa-aaaab-qaipq-cai"),
            userMgmt: Principal.fromText("x3zv6-taaaa-aaaab-qaiqa-cai")
        };    
}