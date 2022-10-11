import type { Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import type { ISnsGovernanceClient } from "./sns.governance.client.interface";
import type { ListNervousSystemFunctionsResponse } from "../../domain/chat/chat";
export declare class SnsGovernanceClient extends CandidService implements ISnsGovernanceClient {
    private service;
    private constructor();
    static create(identity: Identity, canisterId: string): ISnsGovernanceClient;
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
