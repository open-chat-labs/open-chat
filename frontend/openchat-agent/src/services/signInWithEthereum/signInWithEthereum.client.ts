import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithEthereumService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import type {
    GetDelegationResponse,
    PrepareDelegationResponse,
    SiwePrepareLoginResponse,
} from "openchat-shared";
import { getDelegationResponse, loginResponse, prepareLoginResponse } from "./mappers";

export class SignInWithEthereumClient extends CandidCanisterAgent<SignInWithEthereumService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
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
