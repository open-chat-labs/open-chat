import type { Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import type { IOnlineClient } from "./online.client.interface";
export declare class OnlineClient extends CandidService implements IOnlineClient {
    private service;
    private constructor();
    static create(identity: Identity): IOnlineClient;
    markAsOnline(): Promise<void>;
}
