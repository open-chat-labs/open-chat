import type { Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithEthereumService } from "./candid/idl";
import { CandidService } from "../candidService";
import type {
    GetDelegationResponse,
    PrepareDelegationResponse,
    SiwePrepareLoginResponse,
} from "openchat-shared";
import { getDelegationResponse, loginResponse, prepareLoginResponse } from "./mappers";
import type { AgentConfig } from "../../config";

export class SignInWithEthereumClient extends CandidService {
    private service: SignInWithEthereumService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<SignInWithEthereumService>(
            idlFactory,
            config.signInWithEthereumCanister,
            {
                icUrl: config.icUrl,
            },
        );
    }

    static create(identity: Identity, config: AgentConfig): SignInWithEthereumClient {
        return new SignInWithEthereumClient(identity, config);
    }

    prepareLogin(address: string): Promise<SiwePrepareLoginResponse> {
        return this.handleResponse(
            this.service.siwe_prepare_login(address),
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
            this.service.siwe_login(signature, address, sessionKey),
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
            () => this.service.siwe_get_delegation(address, sessionKey, expiration),
            getDelegationResponse,
            [address, sessionKey, expiration],
        );
    }
}
