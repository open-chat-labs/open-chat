import type { Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithEmailService } from "./candid/idl";
import { CandidService } from "../candidService";
import type {
    GenerateEmailVerificationCodeResponse,
    GetDelegationResponse,
    SubmitEmailVerificationCodeResponse,
} from "openchat-shared";
import { generateVerificationCodeResponse, submitVerificationCodeResponse } from "./mappers";
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

    generateVerificationCode(email: string): Promise<GenerateEmailVerificationCodeResponse> {
        const args = { email };
        return this.handleResponse(
            this.service.generate_verification_code(args),
            generateVerificationCodeResponse,
            args,
        );
    }

    submitVerificationCode(
        email: string,
        code: string,
        sessionKey: Uint8Array,
    ): Promise<SubmitEmailVerificationCodeResponse> {
        const args = {
            email,
            code,
            session_key: sessionKey,
            max_time_to_live: [] as [] | [bigint],
        };
        return this.handleResponse(
            this.service.submit_verification_code(args),
            submitVerificationCodeResponse,
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
