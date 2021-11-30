import { HttpAgent } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import type { Principal } from "@dfinity/principal";
export declare abstract class CandidService<T> {
    protected service: T;
    protected constructor(agent: HttpAgent, factory: IDL.InterfaceFactory, canisterId: Principal);
    protected handleResponse<From, To>(service: Promise<From>, mapper: (from: From) => To, args?: unknown): Promise<To>;
}
