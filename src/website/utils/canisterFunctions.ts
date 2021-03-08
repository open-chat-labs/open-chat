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
            chats: Principal.fromText("xo6et-siaaa-aaaab-qaitq-cai"),
            p2p: Principal.fromText("wdqa5-5aaaa-aaaab-qaiua-cai"),
            userMgmt: Principal.fromText("2zip3-tqaaa-aaaaa-qahma-cai")
        };    
}