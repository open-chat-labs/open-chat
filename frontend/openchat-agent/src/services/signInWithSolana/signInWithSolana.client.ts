import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type SignInWithSolanaService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import type {
    GetDelegationResponse,
    PrepareDelegationResponse,
    SiwsPrepareLoginResponse,
} from "openchat-shared";
import { prepareLoginResponse } from "./mappers";
import { getDelegationResponse, loginResponse } from "../signInWithEthereum/mappers";

export class SignInWithSolanaClient extends CandidCanisterAgent<SignInWithSolanaService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
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
