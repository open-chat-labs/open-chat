import type { Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithSolanaService } from "./candid/idl";
import { CandidService } from "../candidService";
import type {
    GetDelegationResponse,
    PrepareDelegationResponse,
    SiwsPrepareLoginResponse,
} from "openchat-shared";
import { prepareLoginResponse } from "./mappers";
import { getDelegationResponse, loginResponse } from "../signInWithEthereum/mappers";
import type { AgentConfig } from "../../config";

export class SignInWithSolanaClient extends CandidService {
    private service: SignInWithSolanaService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<SignInWithSolanaService>(
            idlFactory,
            config.signInWithSolanaCanister,
            {
                icUrl: config.icUrl,
            },
        );
    }

    static create(identity: Identity, config: AgentConfig): SignInWithSolanaClient {
        return new SignInWithSolanaClient(identity, config);
    }

    prepareLogin(address: string): Promise<SiwsPrepareLoginResponse> {
        return this.handleResponse(
            this.service.siws_prepare_login(address),
            prepareLoginResponse,
            address,
        );
    }

    login(
        signature: string,
        address: string,
        sessionKey: Uint8Array,
    ): Promise<PrepareDelegationResponse> {
        return this.handleResponse(
            this.service.siws_login(signature, address, sessionKey),
            loginResponse,
            [signature, address, sessionKey],
        );
    }

    getDelegation(
        address: string,
        sessionKey: Uint8Array,
        expiration: bigint,
    ): Promise<GetDelegationResponse> {
        return this.handleQueryResponse(
            () => this.service.siws_get_delegation(address, sessionKey, expiration),
            getDelegationResponse,
            [address, sessionKey, expiration],
        );
    }
}
