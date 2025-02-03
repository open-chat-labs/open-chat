import {
    Actor, type ActorSubclass,
    HttpAgent,
    type Identity,
} from "@dfinity/agent";
import { toCanisterResponseError } from "../error";
import type {IDL} from "@dfinity/candid";
import { CanisterAgent } from "./base";

export abstract class CandidCanisterAgent<T> extends CanisterAgent {
    protected service: ActorSubclass<T>;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        factory: IDL.InterfaceFactory,
    ) {
        super(identity, agent, canisterId);

        this.service = Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
    ): Promise<To> {
        return this.executeQuery(() => serviceCall(), mapper, args, 0)
    }

    protected handleResponse<From, To>(
        service: Promise<From>,
        mapper: (from: From) => To,
        args?: unknown,
    ): Promise<To> {
        return service.then(mapper).catch((err) => {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        });
    }
}
