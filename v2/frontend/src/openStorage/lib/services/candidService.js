import { Actor } from "@dfinity/agent";
import { toHttpError } from "./httpError";
export class CandidService {
    constructor(agent, factory, canisterId) {
        this.service = Actor.createActor(factory, {
            agent,
            canisterId,
        });
    }
    async handleResponse(service, mapper, args) {
        let response;
        try {
            response = await service;
        }
        catch (e) {
            console.log(e, args);
            throw toHttpError(e);
        }
        return mapper(response);
    }
}
//# sourceMappingURL=candidService.js.map