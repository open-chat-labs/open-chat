import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { toHttpError } from "./httpError";

export abstract class CandidService {
    protected createServiceClient<T>(factory: IDL.InterfaceFactory, canisterId: string): T {
        const agent = new HttpAgent({ identity: this.identity });
        if (process.env.NODE_ENV !== "production") {
            agent.fetchRootKey();
        }
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    protected async handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To
    ): Promise<To> {
        let response: From;
        try {
            response = await service;
        } catch (e) {
            console.log(e);
            throw toHttpError(e);
        }
        return mapper(response);
    }

    constructor(private identity?: Identity) {}
}
