import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import type { GetCurrentUserResponse } from "../domain/user";
import { fromCandid as fromUserResponse } from "./mappers/user";
// import userIndexIdl, {
//     _SERVICE as UserIndexService,
// } from "../../../backend/canisters/user_index/canister";

export class ServiceContainer {
    private createServiceClient<T>(
        identity: Identity,
        factory: IDL.InterfaceFactory,
        canisterId: string
    ): T {
        const agent = new HttpAgent({ identity });
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }

    // eslint-disable-next-line no-unused-vars
    // constructor(private identity: Identity) {
    //     const userService = this.createServiceClient<UserIndexService>(
    //         identity,
    //         userIndexIdl,
    //         "canisterId"
    //     );
    // }

    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return Promise.resolve(fromUserResponse({}));
    }

    // private async handleResponse<From, To>(
    //     service: Promise<From>,
    //     mapper: (from: From) => To
    // ): Promise<To> {
    //     let response: From;
    //     try {
    //         response = await service;
    //     } catch (e) {
    //         throw toHttpError(e);
    //     }
    //     return mapper(response);
    // }
}
