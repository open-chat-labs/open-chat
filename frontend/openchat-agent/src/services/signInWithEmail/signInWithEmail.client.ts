import type { Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithEmailService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { GenerateMagicLinkResponse, GetDelegationResponse } from "openchat-shared";
import { generateMagicLinkResponse } from "./mappers";
import { getDelegationResponse } from "../identity/mappers";
import type { AgentConfig } from "../../config";

export class SignInWithEmailClient extends CandidService {
    private service: SignInWithEmailService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<SignInWithEmailService>(
            idlFactory,
            config.signInWithEmailCanister,
            {
                icUrl: config.icUrl,
            },
        );
    }

    static create(identity: Identity, config: AgentConfig): SignInWithEmailClient {
        return new SignInWithEmailClient(identity, config);
    }

    generateMagicLink(email: string, sessionKey: Uint8Array): Promise<GenerateMagicLinkResponse> {
        const args = { email, session_key: sessionKey, max_time_to_live: [] as [] | [bigint] };
        return this.handleResponse(
            this.service.generate_magic_link(args),
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
            getDelegationResponse,
            args,
        );
    }
}
