import { Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
export declare type ServiceRetryInterrupt = (iterations: number) => boolean;
export declare abstract class CandidService {
    protected identity: Identity;
    protected createServiceClient<T>(factory: IDL.InterfaceFactory, canisterId: string): T;
    protected handleResponse<From, To>(service: Promise<From>, mapper: (from: From) => To, args?: unknown): Promise<To>;
    protected handleQueryResponse<From, To>(serviceCall: () => Promise<From>, mapper: (from: From) => To, args?: unknown, interrupt?: ServiceRetryInterrupt, retries?: number): Promise<To>;
    constructor(identity: Identity);
}
