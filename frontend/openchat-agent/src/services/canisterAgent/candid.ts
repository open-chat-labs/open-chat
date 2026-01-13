import { Actor, type ActorSubclass, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import type { IDL } from "@icp-sdk/core/candid";
import { Principal } from "@icp-sdk/core/principal";
import { toCanisterResponseError } from "../error";
import { CanisterAgent } from "./base";

export abstract class CandidCanisterAgent<T> extends CanisterAgent {
    protected service: ActorSubclass<T>;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string | undefined,
        factory: IDL.InterfaceFactory,
        canisterName: string,
    ) {
        super(identity, agent, canisterName);

        this.service = Actor.createActor<T>(factory, {
            agent,
            canisterId: canisterId ?? Principal.anonymous(),
        });
    }

    protected handleQueryResponse<From, To>(
        serviceCall: () => Promise<From>,
        mapper: (from: From) => To | Promise<To>,
        args?: unknown,
    ): Promise<To> {
        return this.executeQuery(() => serviceCall(), mapper, args, 0);
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
