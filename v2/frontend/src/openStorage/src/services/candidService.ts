import { Actor, HttpAgent } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import type { Principal } from "@dfinity/principal";
import { toHttpError } from "./httpError";

export abstract class CandidService<T> {
    protected service: T;

    protected constructor(agent: HttpAgent, factory: IDL.InterfaceFactory, canisterId: Principal) {
        this.service = Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    protected async handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown
    ): Promise<To> {
        let response: From;
        try {
            response = await service;
        } catch (e) {
            console.log(e, args);
            throw toHttpError(e as Error);
        }
        return mapper(response);
    }
}
