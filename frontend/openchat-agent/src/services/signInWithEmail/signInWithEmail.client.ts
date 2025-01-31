import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithEmailService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import type { GenerateMagicLinkResponse, GetDelegationResponse } from "openchat-shared";
import { generateMagicLinkResponse } from "./mappers";
import { getDelegationResponse } from "../identity/mappers";

export class SignInWithEmailClient extends CanisterAgent {
    private service: SignInWithEmailService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "SignInWithEmail");

        this.service = this.createServiceClient<SignInWithEmailService>(idlFactory);
    }

    generateMagicLink(email: string, sessionKey: Uint8Array): Promise<GenerateMagicLinkResponse> {
        const args = { email, session_key: sessionKey, max_time_to_live: [] as [] | [bigint] };
        return this.handleResponse(
            this.service.generate_magic_link(args),
            "generate_magic_link",
            generateMagicLinkResponse,
            args,
        );
    }

    getDelegation(
        email: string,
        sessionKey: Uint8Array,
        expiration: bigint,
    ): Promise<GetDelegationResponse> {
        const args = {
            email,
            session_key: sessionKey,
            expiration,
        };
        return this.handleQueryResponse(
            () => this.service.get_delegation(args),
            "get_delegation",
            getDelegationResponse,
            args,
        );
    }
}
